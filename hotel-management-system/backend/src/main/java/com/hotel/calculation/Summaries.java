package com.hotel.calculation;

import com.hotel.dto.DashboardDtos.HousekeepingTaskSummary;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.entity.Guest;
import com.hotel.entity.HousekeepingTask;
import com.hotel.entity.Payment;
import com.hotel.entity.Reservation;
import com.hotel.entity.Room;
import com.hotel.entity.StaffMember;
import com.hotel.enums.PaymentStatus;
import com.hotel.enums.RoomType;
import com.hotel.enums.TaskPriority;
import com.hotel.store.HotelData;
import com.hotel.util.MoneyUtils;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.Comparator;
import java.util.Map;
import java.util.function.Predicate;

/** Building blocks shared by every module (frontend mock/calculations/dashboard.ts). */
public final class Summaries {

    public static final String UNKNOWN_GUEST = "Unknown guest";
    public static final String NO_ROOM = "—";

    /** High first. */
    public static final Map<TaskPriority, Integer> PRIORITY_ORDER = Map.of(
            TaskPriority.HIGH, 0, TaskPriority.NORMAL, 1, TaskPriority.LOW, 2);

    /** Room numbers in numeric order (101, 102, ..., 1001). */
    public static final Comparator<String> ROOM_NUMBER_ORDER = Comparator.comparingLong(Summaries::roomNumberValue);

    private Summaries() {
    }

    public static long roomNumberValue(String roomNumber) {
        try {
            return Long.parseLong(roomNumber);
        } catch (NumberFormatException e) {
            return Long.MAX_VALUE;
        }
    }

    public static int nightsOf(Reservation reservation) {
        return (int) ChronoUnit.DAYS.between(reservation.getCheckIn(), reservation.getCheckOut());
    }

    /** Room charges for the stay (rate x nights), before taxes and extras. */
    public static BigDecimal stayAmount(Reservation reservation) {
        return MoneyUtils.multiply(reservation.getRoomRate(), nightsOf(reservation));
    }

    /** Sum of completed payments (refunds are negative, so the result is net). */
    public static BigDecimal completedRevenue(Collection<Payment> payments, Predicate<Payment> predicate) {
        return MoneyUtils.sum(payments.stream()
                .filter(p -> p.getStatus() == PaymentStatus.COMPLETED && predicate.test(p))
                .map(Payment::getAmount));
    }

    public static BigDecimal completedRevenue(Collection<Payment> payments) {
        return completedRevenue(payments, p -> true);
    }

    public static String guestName(HotelData db, String guestId) {
        Guest guest = db.guest(guestId);
        return guest == null ? UNKNOWN_GUEST : guest.getFullName();
    }

    public static ReservationSummary toReservationSummary(HotelData db, Reservation r) {
        Room room = db.room(r.getRoomId());
        return new ReservationSummary(
                r.getId(),
                r.getGuestId(),
                guestName(db, r.getGuestId()),
                r.getRoomId(),
                room == null ? NO_ROOM : room.getRoomNumber(),
                room == null ? RoomType.STANDARD : room.getType(),
                r.getCheckIn(),
                r.getCheckOut(),
                nightsOf(r),
                r.getNumberOfGuests(),
                stayAmount(r),
                r.getSource(),
                r.getStatus(),
                r.getCreatedAt());
    }

    public static HousekeepingTaskSummary toTaskSummary(HotelData db, HousekeepingTask task) {
        Room room = db.room(task.getRoomId());
        StaffMember staff = db.staffMember(task.getAssignedStaffId());
        return new HousekeepingTaskSummary(
                task.getId(),
                room == null ? NO_ROOM : room.getRoomNumber(),
                task.getTaskType(),
                task.getPriority(),
                task.getScheduledDate(),
                staff == null ? "Unassigned" : staff.getFullName(),
                task.getStatus());
    }
}
