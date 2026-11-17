package com.hotel.service.impl;

import com.hotel.calculation.BillCalculator;
import com.hotel.calculation.RoomStatusRules;
import com.hotel.calculation.Summaries;
import com.hotel.dto.BillingDtos.StayBill;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.dto.FrontDeskDtos.CheckInInput;
import com.hotel.dto.FrontDeskDtos.CheckInPreview;
import com.hotel.dto.FrontDeskDtos.CheckInRoomOption;
import com.hotel.dto.FrontDeskDtos.CheckOutInput;
import com.hotel.dto.FrontDeskDtos.CheckOutResult;
import com.hotel.dto.FrontDeskDtos.FrontDeskOverview;
import com.hotel.entity.Guest;
import com.hotel.entity.HousekeepingTask;
import com.hotel.entity.Payment;
import com.hotel.entity.Reservation;
import com.hotel.entity.Room;
import com.hotel.entity.StaffMember;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.Department;
import com.hotel.enums.EmploymentStatus;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.HousekeepingTaskType;
import com.hotel.enums.IdProofType;
import com.hotel.enums.PaymentStatus;
import com.hotel.enums.RoomStatus;
import com.hotel.enums.TaskPriority;
import com.hotel.exception.BusinessRuleException;
import com.hotel.exception.PaymentDeclinedException;
import com.hotel.exception.ResourceNotFoundException;
import com.hotel.exception.ValidationException;
import com.hotel.payment.PaymentGateway;
import com.hotel.payment.PaymentGateway.PaymentRequest;
import com.hotel.payment.PaymentGateway.PaymentResult;
import com.hotel.repository.BaseRepository;
import com.hotel.service.FrontDeskService;
import com.hotel.store.DataStore;
import com.hotel.store.HotelClock;
import com.hotel.store.HotelData;
import com.hotel.util.Formats;
import com.hotel.util.InputValidator;
import com.hotel.util.TextMatching;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Front desk (frontend mock/services/frontDesk.ts).
 * <p>
 * Check-in: pending/confirmed bookings, from the arrival date until the day before departure (late arrivals keep
 * their booked nights). The last 4 characters read from the guest's ID must match the masked number on file.
 * The room must be ready (Available, or Reserved for this arrival), fit the party and be free for the remaining
 * nights; moving the guest keeps the booked rate. The room becomes Occupied.
 * <p>
 * Check-out: checked-in stays only. The departure becomes today, so early and late check-outs are billed for the
 * nights used (one-night minimum). Any balance is settled in the same request through the payment gateway.
 * The room goes to Cleaning and a checkout clean is given to the least busy housekeeper.
 */
@Service
@RequiredArgsConstructor
public class FrontDeskServiceImpl implements FrontDeskService {

    private static final Pattern ID_LAST4 = Pattern.compile("^[A-Z0-9]{4}$");
    private static final Comparator<ReservationSummary> BY_ROOM = Comparator.comparing(ReservationSummary::roomNumber, TextMatching.NATURAL);

    private final DataStore store;
    private final HotelClock clock;
    private final RoomStatusRules roomStatus;
    private final PaymentGateway paymentGateway;
    private final BaseRepository<Reservation> reservations;
    private final BaseRepository<Room> rooms;
    private final BaseRepository<Payment> payments;
    private final BaseRepository<HousekeepingTask> tasks;

    /** A pending/confirmed booking can be checked in from its arrival date until the day before departure. */
    static boolean canCheckIn(Reservation r, LocalDate today) {
        return RoomStatusRules.isUpcoming(r) && !r.getCheckIn().isAfter(today) && r.getCheckOut().isAfter(today);
    }

    // ------------------------------------------------------------------ overview

    @Override
    public FrontDeskOverview overview() {
        return store.read(db -> {
            LocalDate today = clock.today();
            List<Reservation> inHouse = db.reservations().stream().filter(r -> r.getStatus() == BookingStatus.CHECKED_IN).toList();
            return new FrontDeskOverview(
                    today,
                    db.reservations().stream()
                            .filter(r -> canCheckIn(r, today))
                            .sorted(Comparator.comparing(Reservation::getCheckIn).thenComparing(Reservation::getCreatedAt))
                            .map(r -> Summaries.toReservationSummary(db, r)).toList(),
                    inHouse.stream().map(r -> Summaries.toReservationSummary(db, r)).sorted(BY_ROOM).toList(),
                    inHouse.stream()
                            .filter(r -> !r.getCheckOut().isAfter(today))
                            .map(r -> Summaries.toReservationSummary(db, r))
                            .sorted(Comparator.comparing(ReservationSummary::checkOut).thenComparing(BY_ROOM))
                            .toList());
        });
    }

    // ------------------------------------------------------------------ check-in

    @Override
    public CheckInPreview checkInPreview(String reservationId) {
        return store.read(db -> {
            LocalDate today = clock.today();
            Reservation reservation = find(db, reservationId);
            assertCanCheckIn(reservation, today);
            Guest guest = db.guest(reservation.getGuestId());
            Room booked = db.room(reservation.getRoomId());
            int bookedType = booked == null ? 0 : booked.getType().ordinal();

            List<CheckInRoomOption> options = new ArrayList<>();
            if (booked != null) {
                options.add(option(db, booked, reservation, today));
            }
            db.rooms().stream()
                    .filter(r -> !r.getId().equals(reservation.getRoomId()))
                    .map(r -> option(db, r, reservation, today))
                    .filter(CheckInRoomOption::ready)
                    // Same category first, then upgrades, then the rest; cheapest first within a category.
                    .sorted(Comparator.comparingInt((CheckInRoomOption o) -> rank(o.room(), bookedType))
                            .thenComparing(o -> o.room().getPricePerNight())
                            .thenComparing(o -> o.room().getRoomNumber(), TextMatching.NATURAL))
                    .forEach(options::add);

            return new CheckInPreview(
                    Summaries.toReservationSummary(db, reservation),
                    guest == null ? IdProofType.PASSPORT : guest.getIdProofType(),
                    reservation.getCheckIn().isBefore(today),
                    options);
        });
    }

    private static int rank(Room room, int bookedType) {
        int diff = room.getType().ordinal() - bookedType;
        return diff == 0 ? 0 : diff > 0 ? diff : 10 - diff;
    }

    private static CheckInRoomOption option(HotelData db, Room room, Reservation reservation, LocalDate today) {
        String reason = roomBlocker(db, room, reservation, today);
        return new CheckInRoomOption(room, room.getId().equals(reservation.getRoomId()), reason == null, reason);
    }

    @Override
    public ReservationSummary checkIn(String reservationId, CheckInInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            LocalDate today = clock.today();
            Reservation reservation = find(db, reservationId);
            assertCanCheckIn(reservation, today);

            InputValidator v = new InputValidator();
            String roomId = raw.roomId() == null ? "" : raw.roomId();
            String idLast4 = raw.idLast4() == null ? "" : raw.idLast4().replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
            v.text("roomId", roomId).min(1, "Choose the room to assign");
            v.text("idLast4", idLast4).matches(ID_LAST4, "Enter the last 4 letters or digits from the ID document");
            v.throwIfInvalid();

            Guest guest = db.guest(reservation.getGuestId());
            String stored = guest == null ? "" : guest.getIdProofNumber().toUpperCase(Locale.ROOT);
            if (guest == null || !stored.endsWith(idLast4) || stored.length() < 4) {
                // Never echo the stored digits: the check only works if staff read them off the document.
                IdProofType type = guest == null ? IdProofType.PASSPORT : guest.getIdProofType();
                throw new ValidationException("Identity check failed",
                        Map.of("idLast4", "Doesn't match the %s on file. Check the document again.".formatted(Formats.label(type))));
            }

            Room room = db.room(roomId);
            if (room == null) {
                throw ValidationException.of("roomId", "Choose an existing room");
            }
            String blocker = roomBlocker(db, room, reservation, today);
            if (blocker != null) {
                throw new BusinessRuleException("Room %s can't be assigned: %s".formatted(room.getRoomNumber(),
                        Character.toLowerCase(blocker.charAt(0)) + blocker.substring(1)), "roomId");
            }

            String previousRoomId = reservation.getRoomId();
            reservation.setRoomId(room.getId()); // the booked rate is kept, even on a move
            reservation.setStatus(BookingStatus.CHECKED_IN);
            reservation.setCheckedInAt(clock.now());
            Reservation saved = reservations.save(reservation);
            Room occupied = room.copy();
            occupied.setStatus(RoomStatus.OCCUPIED);
            rooms.save(occupied);
            if (!previousRoomId.equals(room.getId())) {
                roomStatus.syncRoomStatus(previousRoomId, today);
            }
            return Summaries.toReservationSummary(store.snapshot(), saved);
        });
    }

    private static void assertCanCheckIn(Reservation reservation, LocalDate today) {
        if (canCheckIn(reservation, today)) {
            return;
        }
        if (!RoomStatusRules.isUpcoming(reservation)) {
            throw new BusinessRuleException("%s is %s and cannot be checked in".formatted(reservation.getId(),
                    Formats.lowerLabel(reservation.getStatus())));
        }
        if (reservation.getCheckIn().isAfter(today)) {
            throw new BusinessRuleException("%s arrives on %s. Check-in opens on the arrival date.".formatted(reservation.getId(),
                    Formats.date(reservation.getCheckIn())));
        }
        throw new BusinessRuleException("%s was due to leave on %s. Cancel the booking or change its dates first.".formatted(
                reservation.getId(), Formats.date(reservation.getCheckOut())));
    }

    /** Why a room cannot be handed over now, or null when it can. */
    static String roomBlocker(HotelData db, Room room, Reservation reservation, LocalDate today) {
        if (room.getStatus() == RoomStatus.MAINTENANCE) {
            return "Under maintenance";
        }
        if (room.getCapacity() < reservation.getNumberOfGuests()) {
            return "Sleeps at most " + room.getCapacity();
        }
        LocalDate from = reservation.getCheckIn().isAfter(today) ? reservation.getCheckIn() : today;
        Optional<Reservation> clash = db.reservations().stream()
                .filter(r -> r.getRoomId().equals(room.getId()) && !r.getId().equals(reservation.getId())
                        && RoomStatusRules.ROOM_HOLDING.contains(r.getStatus())
                        && RoomStatusRules.staysOverlap(r, from, reservation.getCheckOut()))
                .findFirst();
        if (clash.isPresent()) {
            return clash.get().getStatus() == BookingStatus.CHECKED_IN ? "Previous guest has not checked out" : "Booked for " + clash.get().getId();
        }
        if (room.getStatus() == RoomStatus.OCCUPIED) {
            return "Previous guest has not checked out";
        }
        if (room.getStatus() == RoomStatus.CLEANING) {
            return "Being cleaned";
        }
        return null;
    }

    // ------------------------------------------------------------------ check-out

    @Override
    public StayBill checkOutPreview(String reservationId) {
        return store.read(db -> {
            Reservation reservation = find(db, reservationId);
            assertCheckedIn(reservation);
            return BillCalculator.calculateStayBill(db, reservation, clock.today());
        });
    }

    @Override
    public CheckOutResult checkOut(String reservationId, CheckOutInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            LocalDate today = clock.today();
            Reservation reservation = find(db, reservationId);
            assertCheckedIn(reservation);
            StayBill bill = BillCalculator.calculateStayBill(db, reservation, today);

            Payment settlement = null;
            if (bill.balance().signum() > 0) {
                if (raw == null || raw.paymentMethod() == null) {
                    throw new BusinessRuleException("Collect the outstanding %s before check-out".formatted(Formats.currency(bill.balance())),
                            Map.of("paymentMethod", "Choose how the guest is paying"));
                }
                PaymentResult result = paymentGateway.charge(new PaymentRequest(bill.balance(), raw.paymentMethod(), reservation.getId()));
                if (!result.approved()) {
                    throw new PaymentDeclinedException("Payment declined: " + result.declineReason());
                }
                settlement = payments.save(Payment.builder()
                        .reservationId(reservation.getId())
                        .amount(bill.balance())
                        .method(raw.paymentMethod())
                        .paymentDate(clock.now())
                        .status(PaymentStatus.COMPLETED)
                        .transactionReference(result.transactionReference())
                        .build());
            }

            reservation.setStatus(BookingStatus.CHECKED_OUT);
            reservation.setCheckOut(today);
            reservation.setCheckedOutAt(clock.now());
            reservations.save(reservation);

            rooms.findById(reservation.getRoomId()).ifPresent(room -> {
                room.setStatus(RoomStatus.CLEANING);
                rooms.save(room);
            });
            boolean arrivalToday = RoomStatusRules.arrivalToday(db.reservations(), reservation.getRoomId(), today).isPresent();
            HousekeepingTask task = tasks.save(HousekeepingTask.builder()
                    .roomId(reservation.getRoomId())
                    .assignedStaffId(pickHousekeeper(db, today))
                    .taskType(HousekeepingTaskType.CHECKOUT_CLEAN)
                    // Rush the clean when someone is arriving in this room today.
                    .priority(arrivalToday ? TaskPriority.HIGH : TaskPriority.NORMAL)
                    .status(HousekeepingStatus.PENDING)
                    .scheduledDate(today)
                    .notes("Checkout clean after " + reservation.getId())
                    .build());

            HotelData after = store.snapshot();
            Reservation stay = after.reservation(reservation.getId());
            return new CheckOutResult(Summaries.toReservationSummary(after, stay), BillCalculator.calculateStayBill(after, stay),
                    settlement, task.getId());
        });
    }

    private static void assertCheckedIn(Reservation reservation) {
        if (reservation.getStatus() != BookingStatus.CHECKED_IN) {
            throw new BusinessRuleException("%s is %s; only checked-in stays can be checked out".formatted(reservation.getId(),
                    Formats.lowerLabel(reservation.getStatus())));
        }
    }

    /** Least busy active housekeeper today (fewest open tasks), ties by id. */
    private static String pickHousekeeper(HotelData db, LocalDate today) {
        return db.staff().stream()
                .filter(s -> s.getDepartment() == Department.HOUSEKEEPING && s.getEmploymentStatus() == EmploymentStatus.ACTIVE)
                .min(Comparator.comparingLong((StaffMember s) -> db.housekeepingTasks().stream()
                                .filter(t -> t.getAssignedStaffId().equals(s.getId()) && t.getScheduledDate().equals(today)
                                        && t.getStatus() != HousekeepingStatus.COMPLETED)
                                .count())
                        .thenComparing(StaffMember::getId))
                .map(StaffMember::getId)
                .orElse("");
    }

    private static Reservation find(HotelData db, String id) {
        Reservation reservation = db.reservation(id);
        if (reservation == null) {
            throw new ResourceNotFoundException("Reservation", id);
        }
        return reservation.copy();
    }
}
