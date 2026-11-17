package com.hotel.calculation;

import com.hotel.entity.HousekeepingTask;
import com.hotel.entity.Reservation;
import com.hotel.entity.Room;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.HousekeepingTaskType;
import com.hotel.enums.RoomStatus;
import com.hotel.repository.BaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Optional;
import java.util.Set;

/**
 * Room-status rules shared by reservations, front desk and housekeeping (frontend mock/rules/roomStatus.ts).
 * <p>
 * "Reserved" means the room is ready and held for a guest arriving today. It is derived, never set by hand:
 * an Available room with a pending/confirmed arrival today becomes Reserved, and a Reserved room whose
 * arrival is cancelled, moved or re-dated becomes Available again. Occupied, Cleaning and Maintenance are
 * owned by check-in/out and housekeeping. Call the mutating methods inside {@code DataStore.write}.
 */
@Component
@RequiredArgsConstructor
public class RoomStatusRules {

    /** Bookings that hold a room for their dates. */
    public static final Set<BookingStatus> ROOM_HOLDING = Set.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN);
    /** Task types that keep a room in Cleaning until they are done. */
    public static final Set<HousekeepingTaskType> CLEANING_TYPES = Set.of(HousekeepingTaskType.CHECKOUT_CLEAN, HousekeepingTaskType.DEEP_CLEAN);

    private final BaseRepository<Room> rooms;
    private final BaseRepository<Reservation> reservations;
    private final BaseRepository<HousekeepingTask> tasks;

    public static boolean isUpcoming(Reservation r) {
        return r.getStatus() == BookingStatus.PENDING || r.getStatus() == BookingStatus.CONFIRMED;
    }

    /** Half-open night ranges: a departure on day X and an arrival on day X do not clash. */
    public static boolean staysOverlap(Reservation r, LocalDate checkIn, LocalDate checkOut) {
        return r.getCheckIn().isBefore(checkOut) && checkIn.isBefore(r.getCheckOut());
    }

    public static Optional<Reservation> arrivalToday(Collection<Reservation> all, String roomId, LocalDate today) {
        return all.stream()
                .filter(r -> r.getRoomId().equals(roomId) && r.getCheckIn().equals(today) && isUpcoming(r))
                .findFirst();
    }

    /** Re-derives Available/Reserved for one room from today's arrivals. */
    public void syncRoomStatus(String roomId, LocalDate today) {
        rooms.findById(roomId).ifPresent(room -> {
            boolean held = arrivalToday(reservations.findAll(), roomId, today).isPresent();
            if (room.getStatus() == RoomStatus.AVAILABLE && held) {
                room.setStatus(RoomStatus.RESERVED);
                rooms.save(room);
            } else if (room.getStatus() == RoomStatus.RESERVED && !held) {
                room.setStatus(RoomStatus.AVAILABLE);
                rooms.save(room);
            }
        });
    }

    /**
     * After a housekeeping change: a room in Cleaning with no open checkout or deep clean left becomes
     * Available, or Reserved when a guest arrives today. Returns true when the room was released.
     */
    public boolean releaseRoomIfClean(String roomId, LocalDate today) {
        Optional<Room> found = rooms.findById(roomId);
        if (found.isEmpty() || found.get().getStatus() != RoomStatus.CLEANING) {
            return false;
        }
        boolean stillCleaning = tasks.findAll(t -> t.getRoomId().equals(roomId)
                && t.getStatus() != HousekeepingStatus.COMPLETED
                && CLEANING_TYPES.contains(t.getTaskType())).size() > 0;
        if (stillCleaning) {
            return false;
        }
        Room room = found.get();
        room.setStatus(RoomStatus.AVAILABLE);
        rooms.save(room);
        syncRoomStatus(roomId, today);
        return true;
    }
}
