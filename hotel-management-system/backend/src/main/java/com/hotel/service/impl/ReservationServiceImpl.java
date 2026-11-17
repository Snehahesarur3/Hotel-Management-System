package com.hotel.service.impl;

import com.hotel.calculation.Pricing;
import com.hotel.calculation.RoomStatusRules;
import com.hotel.calculation.Summaries;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.dto.ReservationDtos.AvailableRoom;
import com.hotel.dto.ReservationDtos.ReservationDetails;
import com.hotel.dto.ReservationDtos.ReservationInput;
import com.hotel.entity.Guest;
import com.hotel.entity.Payment;
import com.hotel.entity.Reservation;
import com.hotel.entity.Room;
import com.hotel.enums.BookingSource;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.RoomStatus;
import com.hotel.enums.RoomType;
import com.hotel.exception.BusinessRuleException;
import com.hotel.exception.ResourceNotFoundException;
import com.hotel.exception.ValidationException;
import com.hotel.repository.BaseRepository;
import com.hotel.service.ReservationService;
import com.hotel.store.DataStore;
import com.hotel.store.HotelClock;
import com.hotel.store.HotelData;
import com.hotel.util.Formats;
import com.hotel.util.InputValidator;
import com.hotel.util.ListQueries;
import com.hotel.util.TextMatching;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Reservations (frontend mock/services/reservations.ts):
 * <ul>
 *   <li>a room cannot hold two pending/confirmed/checked-in bookings on the same night;</li>
 *   <li>the party must fit the room, and rooms under maintenance are not bookable;</li>
 *   <li>check-in cannot be in the past; stays are 1–30 nights;</li>
 *   <li>the nightly rate is locked in at booking (kept on date changes, re-locked on a room change);</li>
 *   <li>only pending/confirmed bookings can be edited or cancelled;</li>
 *   <li>every change re-derives the Available/Reserved status of the rooms involved.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ReservationServiceImpl implements ReservationService {

    public static final int MAX_NIGHTS = 30;
    public static final int MAX_GUESTS = 10;

    private final DataStore store;
    private final HotelClock clock;
    private final RoomStatusRules roomStatus;
    private final BaseRepository<Reservation> reservations;

    // ------------------------------------------------------------------ queries

    @Override
    public PageResponse<ReservationSummary> list(ListQuery query, BookingStatus status, BookingSource source, String from, String to) {
        LocalDate fromDate = InputValidator.optionalDate("from", from);
        LocalDate toDate = InputValidator.optionalDate("to", to);
        return store.read(db -> ListQueries.apply(
                db.reservations().stream().map(r -> Summaries.toReservationSummary(db, r)).toList(), query,
                ListQueries.Spec.<ReservationSummary>of()
                        .search(s -> {
                            Guest g = db.guest(s.guestId());
                            return Arrays.asList(s.id(), s.guestName(), g == null ? null : g.getEmail(), g == null ? null : g.getPhone(),
                                    s.roomNumber(), Formats.label(s.roomType()));
                        })
                        .filterIf(status, st -> s -> s.status() == st)
                        .filterIf(source, src -> s -> s.source() == src)
                        // In the hotel at any point of the range, arrival and departure days included.
                        .filterIf(fromDate, f -> s -> !s.checkOut().isBefore(f))
                        .filterIf(toDate, t -> s -> !s.checkIn().isAfter(t))
                        .sortBy("checkIn", ReservationSummary::checkIn)
                        .sortBy("checkOut", ReservationSummary::checkOut)
                        .sortBy("createdAt", ReservationSummary::createdAt)
                        .sortBy("guestName", ReservationSummary::guestName)
                        .sortBy("roomNumber", s -> Summaries.roomNumberValue(s.roomNumber()))
                        .sortBy("totalAmount", ReservationSummary::totalAmount)
                        .sortBy("status", s -> s.status().ordinal())
                        .defaultOrder(Comparator.comparing(ReservationSummary::checkIn)
                                .thenComparing(ReservationSummary::createdAt).reversed())));
    }

    @Override
    public ReservationDetails get(String id) {
        return store.read(db -> {
            Reservation reservation = find(db, id);
            Room room = db.room(reservation.getRoomId());
            Guest guest = db.guest(reservation.getGuestId());
            List<Payment> payments = db.payments().stream()
                    .filter(p -> p.getReservationId().equals(id))
                    .sorted(Comparator.comparing(Payment::getPaymentDate).reversed())
                    .toList();
            return new ReservationDetails(
                    Summaries.toReservationSummary(db, reservation),
                    reservation.getRoomRate(),
                    room == null ? 0 : room.getFloor(),
                    room == null ? 0 : room.getCapacity(),
                    guest == null ? "" : guest.getEmail(),
                    guest == null ? "" : guest.getPhone(),
                    Pricing.quoteStay(reservation.getRoomRate(), reservation.getCheckIn(), reservation.getCheckOut(),
                            db.settings().taxes().roomGstSlabs()),
                    payments,
                    Summaries.completedRevenue(payments));
        });
    }

    @Override
    public List<AvailableRoom> availability(String checkIn, String checkOut, Integer guests, RoomType type, String excludeReservationId) {
        return store.read(db -> {
            Reservation excluded = excludeReservationId == null || excludeReservationId.isBlank() ? null : db.reservation(excludeReservationId);
            LocalDate today = clock.today();
            LocalDate earliest = excluded != null && excluded.getCheckIn().isBefore(today) ? excluded.getCheckIn() : today;

            InputValidator v = new InputValidator();
            LocalDate in = v.date("checkIn", checkIn, "Select the check-in date", "Select the check-in date");
            LocalDate out = v.date("checkOut", checkOut, "Select the check-out date", "Select the check-out date");
            if (in != null && in.isBefore(earliest)) {
                v.reject("checkIn", "Check-in cannot be in the past");
            }
            if (in != null && out != null) {
                checkNights(v, in, out);
            }
            if (guests == null || guests < 1 || guests > MAX_GUESTS) {
                v.reject("guests", "Enter 1–" + MAX_GUESTS + " guests");
            }
            v.throwIfInvalid();

            String excludedId = excluded == null ? null : excluded.getId();
            return db.rooms().stream()
                    .filter(room -> room.getStatus() != RoomStatus.MAINTENANCE
                            && room.getCapacity() >= guests
                            && (type == null || room.getType() == type)
                            && conflicts(db, room.getId(), in, out, excludedId).isEmpty())
                    .sorted(Comparator.comparing((Room r) -> r.getType().ordinal())
                            .thenComparing(Room::getPricePerNight)
                            .thenComparing(Room::getRoomNumber, TextMatching.NATURAL))
                    .map(room -> {
                        // The booking being edited keeps its locked-in rate for its own room.
                        var rate = excluded != null && excluded.getRoomId().equals(room.getId()) ? excluded.getRoomRate() : room.getPricePerNight();
                        return new AvailableRoom(room, Pricing.quoteStay(rate, in, out, db.settings().taxes().roomGstSlabs()));
                    })
                    .toList();
        });
    }

    // ------------------------------------------------------------------ commands

    @Override
    public ReservationSummary create(ReservationInput raw) {
        return store.write(() -> {
            LocalDate today = clock.today();
            Booking input = validate(raw, today);
            HotelData db = store.snapshot();
            Room room = assertBookable(db, input, null);
            Reservation reservation = Reservation.builder()
                    .guestId(input.guestId())
                    .roomId(input.roomId())
                    .checkIn(input.checkIn())
                    .checkOut(input.checkOut())
                    .numberOfGuests(input.numberOfGuests())
                    .roomRate(room.getPricePerNight())
                    .source(input.source())
                    .status(input.status())
                    .createdAt(clock.now())
                    .build();
            Reservation saved = reservations.save(reservation);
            roomStatus.syncRoomStatus(saved.getRoomId(), today);
            return Summaries.toReservationSummary(store.snapshot(), saved);
        });
    }

    @Override
    public ReservationSummary update(String id, ReservationInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            Reservation existing = find(db, id);
            assertEditable(existing, "edited");
            LocalDate today = clock.today();
            LocalDate earliest = existing.getCheckIn().isBefore(today) ? existing.getCheckIn() : today;
            Booking input = validate(raw, earliest);
            Room room = assertBookable(db, input, id);
            Reservation updated = existing.toBuilder()
                    .guestId(input.guestId())
                    .roomId(input.roomId())
                    .checkIn(input.checkIn())
                    .checkOut(input.checkOut())
                    .numberOfGuests(input.numberOfGuests())
                    .source(input.source())
                    .status(input.status())
                    // Keep the locked-in rate unless the guest moves to another room.
                    .roomRate(input.roomId().equals(existing.getRoomId()) ? existing.getRoomRate() : room.getPricePerNight())
                    .build();
            Reservation saved = reservations.save(updated);
            roomStatus.syncRoomStatus(existing.getRoomId(), today);
            roomStatus.syncRoomStatus(saved.getRoomId(), today);
            return Summaries.toReservationSummary(store.snapshot(), saved);
        });
    }

    @Override
    public ReservationSummary cancel(String id) {
        return store.write(() -> {
            Reservation reservation = find(store.snapshot(), id);
            assertEditable(reservation, "cancelled");
            reservation.setStatus(BookingStatus.CANCELLED);
            Reservation saved = reservations.save(reservation);
            roomStatus.syncRoomStatus(saved.getRoomId(), clock.today());
            return Summaries.toReservationSummary(store.snapshot(), saved);
        });
    }

    // ------------------------------------------------------------------ rules

    /** A validated booking request. */
    record Booking(String guestId, String roomId, LocalDate checkIn, LocalDate checkOut, int numberOfGuests,
                   BookingSource source, BookingStatus status) {
    }

    private static Reservation find(HotelData db, String id) {
        Reservation reservation = db.reservation(id);
        if (reservation == null) {
            throw new ResourceNotFoundException("Reservation", id);
        }
        return reservation.copy();
    }

    static List<Reservation> conflicts(HotelData db, String roomId, LocalDate checkIn, LocalDate checkOut, String excludeId) {
        return db.reservations().stream()
                .filter(r -> r.getRoomId().equals(roomId) && !r.getId().equals(excludeId)
                        && RoomStatusRules.ROOM_HOLDING.contains(r.getStatus())
                        && RoomStatusRules.staysOverlap(r, checkIn, checkOut))
                .toList();
    }

    private static void checkNights(InputValidator v, LocalDate checkIn, LocalDate checkOut) {
        long nights = ChronoUnit.DAYS.between(checkIn, checkOut);
        if (nights < 1) {
            v.reject("checkOut", "Check-out must be after check-in");
        } else if (nights > MAX_NIGHTS) {
            v.reject("checkOut", "A booking can cover at most " + MAX_NIGHTS + " nights");
        }
    }

    /** Same rules and messages as the frontend's reservationInputSchema. */
    static Booking validate(ReservationInput input, LocalDate earliestCheckIn) {
        InputValidator v = new InputValidator();
        v.text("guestId", input.guestId()).min(1, "Select a guest");
        v.text("roomId", input.roomId()).min(1, "Select an available room");
        LocalDate in = v.date("checkIn", input.checkIn(), "Select the check-in date", "Use the format yyyy-mm-dd");
        LocalDate out = v.date("checkOut", input.checkOut(), "Select the check-out date", "Use the format yyyy-mm-dd");
        v.number("numberOfGuests", input.numberOfGuests()).required("Enter the number of guests")
                .min(1, "At least 1 guest").max(MAX_GUESTS, "At most " + MAX_GUESTS + " guests");
        v.required("source", input.source(), "Select a booking source");
        if (input.status() != BookingStatus.PENDING && input.status() != BookingStatus.CONFIRMED) {
            v.reject("status", "Select Pending or Confirmed");
        }
        if (in != null && out != null) {
            if (in.isBefore(earliestCheckIn)) {
                v.reject("checkIn", "Check-in cannot be before " + Formats.date(earliestCheckIn));
            }
            checkNights(v, in, out);
        }
        v.throwIfInvalid();
        return new Booking(input.guestId(), input.roomId(), in, out, input.numberOfGuests(), input.source(), input.status());
    }

    /** Business checks beyond the input rules. Returns the room being booked. */
    private static Room assertBookable(HotelData db, Booking input, String excludeId) {
        if (db.guest(input.guestId()) == null) {
            throw ValidationException.of("guestId", "Select an existing guest");
        }
        Room room = db.room(input.roomId());
        if (room == null) {
            throw ValidationException.of("roomId", "Select an existing room");
        }
        if (room.getStatus() == RoomStatus.MAINTENANCE) {
            throw new BusinessRuleException("Room %s is under maintenance and cannot be booked".formatted(room.getRoomNumber()), "roomId");
        }
        if (input.numberOfGuests() > room.getCapacity()) {
            throw ValidationException.of("numberOfGuests", "Room %s sleeps at most %s".formatted(room.getRoomNumber(),
                    Formats.plural(room.getCapacity(), "guest")));
        }
        conflicts(db, room.getId(), input.checkIn(), input.checkOut(), excludeId).stream().findFirst().ifPresent(clash -> {
            throw new BusinessRuleException("Room %s is already booked %s – %s (%s)".formatted(room.getRoomNumber(),
                    Formats.shortDate(clash.getCheckIn()), Formats.shortDate(clash.getCheckOut()), clash.getId()), "roomId");
        });
        return room;
    }

    private static void assertEditable(Reservation reservation, String action) {
        if (RoomStatusRules.isUpcoming(reservation)) {
            return;
        }
        Map<BookingStatus, String> reason = Map.of(
                BookingStatus.CHECKED_IN, action.equals("cancelled")
                        ? "The guest is in-house; check them out instead."
                        : "Changes to an in-house stay are made at the front desk.",
                BookingStatus.CHECKED_OUT, "The stay is complete.",
                BookingStatus.CANCELLED, "It is already cancelled.");
        throw new BusinessRuleException("%s is %s and cannot be %s. %s".formatted(reservation.getId(),
                Formats.lowerLabel(reservation.getStatus()), action, reason.getOrDefault(reservation.getStatus(), "")).trim());
    }
}
