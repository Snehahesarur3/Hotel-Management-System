package com.hotel.service.impl;

import com.hotel.calculation.RoomStatusRules;
import com.hotel.calculation.Summaries;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.dto.RoomDtos.RoomActivity;
import com.hotel.dto.RoomDtos.RoomInput;
import com.hotel.entity.HousekeepingTask;
import com.hotel.entity.Reservation;
import com.hotel.entity.Room;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.RoomStatus;
import com.hotel.enums.RoomType;
import com.hotel.exception.BusinessRuleException;
import com.hotel.exception.ResourceNotFoundException;
import com.hotel.exception.ValidationException;
import com.hotel.repository.BaseRepository;
import com.hotel.service.RoomService;
import com.hotel.store.DataStore;
import com.hotel.store.HotelClock;
import com.hotel.store.HotelData;
import com.hotel.util.Formats;
import com.hotel.util.InputValidator;
import com.hotel.util.ListQueries;
import com.hotel.util.TextMatching;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Rooms (frontend mock/services/rooms.ts):
 * <ul>
 *   <li>room numbers are unique and start with their floor number;</li>
 *   <li>Occupied/Reserved are workflow-driven and cannot be set or overridden by hand;</li>
 *   <li>capacity cannot drop below the party size of an active or upcoming booking;</li>
 *   <li>rooms with booking, housekeeping or restaurant history cannot be deleted.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    /** Statuses staff may set by hand. */
    static final Set<RoomStatus> MANUAL_STATUSES = EnumSet.of(RoomStatus.AVAILABLE, RoomStatus.CLEANING, RoomStatus.MAINTENANCE);
    private static final Pattern ROOM_NUMBER = Pattern.compile("^\\d{3,4}$");

    private final DataStore store;
    private final HotelClock clock;
    private final BaseRepository<Room> rooms;

    @Override
    public PageResponse<Room> list(ListQuery query, Integer floor, RoomType type, RoomStatus status) {
        return store.read(db -> ListQueries.apply(db.rooms(), query, ListQueries.Spec.<Room>of()
                .search(r -> {
                    List<Object> fields = new ArrayList<>(List.of(r.getRoomNumber(), r.getType().name(), Formats.label(r.getType()),
                            r.getStatus().name(), Formats.label(r.getStatus()), r.getDescription() == null ? "" : r.getDescription()));
                    fields.addAll(r.getAmenities());
                    return fields;
                })
                .filterIf(floor, f -> r -> r.getFloor() == f)
                .filterIf(type, t -> r -> r.getType() == t)
                .filterIf(status, s -> r -> r.getStatus() == s)
                .sortBy("roomNumber", r -> Summaries.roomNumberValue(r.getRoomNumber()))
                .sortBy("floor", Room::getFloor)
                .sortBy("type", r -> r.getType().ordinal())
                .sortBy("capacity", Room::getCapacity)
                .sortBy("pricePerNight", Room::getPricePerNight)
                .sortBy("status", r -> r.getStatus().ordinal())
                .defaultOrder(Comparator.comparing(Room::getRoomNumber, TextMatching.NATURAL))));
    }

    @Override
    public Room get(String id) {
        return store.read(db -> find(db, id));
    }

    @Override
    public List<Integer> floors() {
        return store.read(db -> db.rooms().stream().map(Room::getFloor).distinct().sorted().toList());
    }

    @Override
    public RoomActivity activity(String id) {
        return store.read(db -> {
            find(db, id);
            List<Reservation> stays = db.reservations().stream().filter(r -> r.getRoomId().equals(id)).toList();
            Optional<Reservation> current = stays.stream().filter(r -> r.getStatus() == BookingStatus.CHECKED_IN).findFirst();
            List<ReservationSummary> upcoming = stays.stream()
                    .filter(RoomStatusRules::isUpcoming)
                    .sorted(Comparator.comparing(Reservation::getCheckIn))
                    .map(r -> Summaries.toReservationSummary(db, r)).toList();
            List<ReservationSummary> history = stays.stream()
                    .filter(r -> r.getStatus() == BookingStatus.CHECKED_OUT || r.getStatus() == BookingStatus.CANCELLED)
                    .sorted(Comparator.comparing(Reservation::getCheckIn).reversed())
                    .map(r -> Summaries.toReservationSummary(db, r)).toList();
            return new RoomActivity(
                    current.map(r -> Summaries.toReservationSummary(db, r)).orElse(null),
                    upcoming,
                    history,
                    db.housekeepingTasks().stream()
                            .filter(t -> t.getRoomId().equals(id))
                            .sorted(Comparator.comparing((HousekeepingTask t) -> t.getStatus() == HousekeepingStatus.COMPLETED)
                                    .thenComparing(t -> Summaries.PRIORITY_ORDER.get(t.getPriority()))
                                    .thenComparing(HousekeepingTask::getScheduledDate, Comparator.reverseOrder()))
                            .map(t -> Summaries.toTaskSummary(db, t))
                            .toList());
        });
    }

    @Override
    public Room create(RoomInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            RoomInput input = validate(raw);
            assertRoomNumberAvailable(db, input.roomNumber(), null);
            if (!MANUAL_STATUSES.contains(input.status())) {
                throw ValidationException.of("status", "A new room can only start as Available, Cleaning or Maintenance");
            }
            String preferredId = "RM-" + input.roomNumber();
            Room room = toRoom(input);
            room.setId(db.room(preferredId) == null ? preferredId : null); // null: the repository assigns the next id
            return rooms.save(room);
        });
    }

    @Override
    public Room update(String id, RoomInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            Room existing = find(db, id);
            RoomInput input = validate(raw);
            assertRoomNumberAvailable(db, input.roomNumber(), id);
            assertCapacityFits(db, existing, input.capacity());
            Room room = toRoom(input);
            room.setId(id);
            room.setStatus(resolveManualStatus(db, existing, input.status()));
            return rooms.save(room);
        });
    }

    @Override
    public Room updateStatus(String id, RoomStatus status) {
        if (status == null) {
            throw ValidationException.of("status", "Unknown room status");
        }
        return store.write(() -> {
            HotelData db = store.snapshot();
            Room room = find(db, id);
            room.setStatus(resolveManualStatus(db, room, status));
            return rooms.save(room);
        });
    }

    @Override
    public void delete(String id) {
        store.write(() -> {
            HotelData db = store.snapshot();
            Room room = find(db, id);
            long bookings = db.reservations().stream().filter(r -> r.getRoomId().equals(id)).count();
            long tasks = db.housekeepingTasks().stream().filter(t -> t.getRoomId().equals(id)).count();
            long orders = db.restaurantOrders().stream().filter(o -> o.getRoomId().equals(id)).count();
            if (bookings + tasks + orders > 0) {
                List<String> parts = new ArrayList<>();
                if (bookings > 0) parts.add(Formats.plural(bookings, "reservation"));
                if (tasks > 0) parts.add(Formats.plural(tasks, "housekeeping task"));
                if (orders > 0) parts.add(Formats.plural(orders, "restaurant order"));
                throw new BusinessRuleException("Room %s has history (%s) and cannot be deleted. Set it to Maintenance to take it out of service."
                        .formatted(room.getRoomNumber(), String.join(", ", parts)));
            }
            rooms.deleteById(id);
        });
    }

    // ------------------------------------------------------------------ rules

    private static Room find(HotelData db, String id) {
        Room room = db.room(id);
        if (room == null) {
            throw new ResourceNotFoundException("Room", id);
        }
        return room.copy();
    }

    private static void assertRoomNumberAvailable(HotelData db, String roomNumber, String exceptId) {
        boolean clash = db.rooms().stream().anyMatch(r -> r.getRoomNumber().equals(roomNumber) && !r.getId().equals(exceptId));
        if (clash) {
            throw new BusinessRuleException("Room " + roomNumber + " already exists", "roomNumber");
        }
    }

    private static void assertCapacityFits(HotelData db, Room room, int capacity) {
        int largest = db.reservations().stream()
                .filter(r -> r.getRoomId().equals(room.getId()) && RoomStatusRules.ROOM_HOLDING.contains(r.getStatus()))
                .mapToInt(Reservation::getNumberOfGuests).max().orElse(0);
        if (capacity < largest) {
            throw new BusinessRuleException("An active or upcoming booking has " + largest + " guests; capacity cannot be lower", "capacity");
        }
    }

    /** Validates a manual status change; setting Available on a room with an arrival today stores Reserved. */
    private RoomStatus resolveManualStatus(HotelData db, Room room, RoomStatus target) {
        if (target == room.getStatus()) {
            return target;
        }
        if (room.getStatus() == RoomStatus.OCCUPIED) {
            throw new BusinessRuleException("Room %s has a guest in-house. Check the guest out to change its status.".formatted(room.getRoomNumber()));
        }
        Optional<Reservation> arrival = RoomStatusRules.arrivalToday(db.reservations(), room.getId(), clock.today());
        if (room.getStatus() == RoomStatus.RESERVED) {
            throw new BusinessRuleException("Room %s is held for today's arrival%s. Reassign or cancel that booking first."
                    .formatted(room.getRoomNumber(), arrival.map(r -> " (" + r.getId() + ")").orElse("")));
        }
        if (!MANUAL_STATUSES.contains(target)) {
            String message = Formats.label(target) + " is set automatically by reservations and check-in";
            throw new ValidationException(message, Map.of("status", message));
        }
        return target == RoomStatus.AVAILABLE && arrival.isPresent() ? RoomStatus.RESERVED : target;
    }

    /** Same rules and messages as the frontend's roomInputSchema. */
    static RoomInput validate(RoomInput input) {
        InputValidator v = new InputValidator();
        String roomNumber = input.roomNumber() == null ? "" : input.roomNumber();
        v.text("roomNumber", roomNumber).matches(ROOM_NUMBER, "Use 3–4 digits, e.g. 204");
        v.number("floor", input.floor()).required("Floor is required").min(1, "Floor must be 1 or higher").max(99, "Floor must be 99 or lower");
        v.required("type", input.type(), "Select a room type");
        v.number("capacity", input.capacity()).required("Capacity is required").min(1, "At least 1 guest").max(10, "At most 10 guests");
        v.number("pricePerNight", input.pricePerNight()).required("Price is required")
                .min(500, "Minimum ₹500 per night").max(500_000, "Maximum ₹5,00,000 per night").cents("Use at most 2 decimal places");
        List<String> amenities = input.amenities() == null ? List.of() : input.amenities();
        v.rejectIf(amenities.stream().anyMatch(a -> a == null || a.isBlank() || a.length() > 40), "amenities", "Each amenity must be 1–40 characters");
        v.rejectIf(amenities.size() > 20, "amenities", "At most 20 amenities");
        v.required("status", input.status(), "Select a status");
        v.text("description", input.description()).max(500, "At most 500 characters");
        if (!v.has("roomNumber") && input.floor() != null && !v.has("floor")) {
            String floor = String.valueOf(input.floor());
            if (!(roomNumber.startsWith(floor) && roomNumber.length() == floor.length() + 2)) {
                v.reject("roomNumber", "Room numbers on floor %s look like %s01–%s99".formatted(floor, floor, floor));
            }
        }
        v.throwIfInvalid();
        return new RoomInput(roomNumber, input.floor(), input.type(), input.capacity(), input.pricePerNight(),
                List.copyOf(new LinkedHashSet<>(amenities)), input.status(), input.description() == null ? "" : input.description());
    }

    private static Room toRoom(RoomInput input) {
        return Room.builder()
                .roomNumber(input.roomNumber())
                .floor(input.floor())
                .type(input.type())
                .capacity(input.capacity())
                .pricePerNight(input.pricePerNight())
                .amenities(new ArrayList<>(input.amenities()))
                .status(input.status())
                .description(input.description())
                .build();
    }
}
