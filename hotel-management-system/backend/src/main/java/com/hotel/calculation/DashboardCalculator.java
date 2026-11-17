package com.hotel.calculation;

import com.hotel.dto.DashboardDtos.CategoryCount;
import com.hotel.dto.DashboardDtos.DashboardKpis;
import com.hotel.dto.DashboardDtos.DashboardSummary;
import com.hotel.dto.DashboardDtos.HousekeepingOverview;
import com.hotel.dto.DashboardDtos.OccupancyPoint;
import com.hotel.dto.DashboardDtos.OccupancySeries;
import com.hotel.dto.DashboardDtos.RevenuePoint;
import com.hotel.dto.DashboardDtos.RevenueSeries;
import com.hotel.dto.DashboardDtos.RoomTypeBreakdown;
import com.hotel.dto.DashboardDtos.TransactionSummary;
import com.hotel.entity.HousekeepingTask;
import com.hotel.entity.Payment;
import com.hotel.entity.Reservation;
import com.hotel.enums.BookingSource;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.RoomStatus;
import com.hotel.enums.RoomType;
import com.hotel.store.HotelData;
import com.hotel.util.MoneyUtils;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * Dashboard figures (frontend mock/calculations/dashboard.ts). Nothing is hard-coded:
 * every figure is derived from rooms, reservations, payments and tasks.
 */
public final class DashboardCalculator {

    private static final Set<BookingStatus> ARRIVAL_STATUSES = Set.of(BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN);
    private static final Set<BookingStatus> DEPARTURE_STATUSES = Set.of(BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT);
    /** Stays that physically used the room on a night. */
    private static final Set<BookingStatus> STAYED_STATUSES = Set.of(BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT);
    private static final int LIST_LIMIT = 5;

    private DashboardCalculator() {
    }

    public static DashboardSummary summary(HotelData db, LocalDate today) {
        int occupied = countRooms(db, RoomStatus.OCCUPIED);
        List<Reservation> arrivals = db.reservations().stream()
                .filter(r -> r.getCheckIn().equals(today) && ARRIVAL_STATUSES.contains(r.getStatus()))
                .sorted(Comparator.comparing(Reservation::getCreatedAt))
                .toList();
        List<Reservation> departures = db.reservations().stream()
                .filter(r -> r.getCheckOut().equals(today) && DEPARTURE_STATUSES.contains(r.getStatus()))
                .sorted(Comparator.comparing(Reservation::getCreatedAt))
                .toList();

        List<Reservation> live = db.reservations().stream().filter(r -> r.getStatus() != BookingStatus.CANCELLED).toList();
        List<CategoryCount<BookingSource>> sources = Arrays.stream(BookingSource.values())
                .map(s -> new CategoryCount<>(s, (int) live.stream().filter(r -> r.getSource() == s).count()))
                .sorted(Comparator.comparingInt((CategoryCount<BookingSource> c) -> c.count()).reversed())
                .toList();
        List<RoomTypeBreakdown> roomTypes = Arrays.stream(RoomType.values()).map(type -> new RoomTypeBreakdown(type,
                (int) db.rooms().stream().filter(r -> r.getType() == type).count(),
                (int) db.rooms().stream().filter(r -> r.getType() == type && r.getStatus() == RoomStatus.OCCUPIED).count())).toList();

        List<HousekeepingTask> todaysTasks = db.housekeepingTasks().stream().filter(t -> t.getScheduledDate().equals(today)).toList();
        HousekeepingOverview housekeeping = new HousekeepingOverview(
                countTasks(todaysTasks, HousekeepingStatus.PENDING),
                countTasks(todaysTasks, HousekeepingStatus.IN_PROGRESS),
                countTasks(todaysTasks, HousekeepingStatus.COMPLETED),
                todaysTasks.stream()
                        .filter(t -> t.getStatus() != HousekeepingStatus.COMPLETED)
                        .sorted(Comparator.comparing((HousekeepingTask t) -> Summaries.PRIORITY_ORDER.get(t.getPriority()))
                                .thenComparing(HousekeepingTask::getId))
                        .map(t -> Summaries.toTaskSummary(db, t))
                        .toList());

        List<TransactionSummary> transactions = db.payments().stream()
                .sorted(Comparator.comparing(Payment::getPaymentDate).reversed())
                .limit(LIST_LIMIT)
                .map(p -> {
                    Reservation reservation = db.reservation(p.getReservationId());
                    String guest = reservation == null ? Summaries.UNKNOWN_GUEST : Summaries.guestName(db, reservation.getGuestId());
                    return new TransactionSummary(p.getId(), p.getReservationId(), guest, p.getAmount(), p.getMethod(), p.getStatus(), p.getPaymentDate());
                })
                .toList();

        YearMonth month = YearMonth.from(today);
        DashboardKpis kpis = new DashboardKpis(
                db.rooms().size(),
                countRooms(db, RoomStatus.AVAILABLE),
                occupied,
                countRooms(db, RoomStatus.RESERVED),
                countRooms(db, RoomStatus.CLEANING),
                countRooms(db, RoomStatus.MAINTENANCE),
                arrivals.size(),
                departures.size(),
                Summaries.completedRevenue(db.payments()),
                Summaries.completedRevenue(db.payments(), p -> YearMonth.from(p.getPaymentDate()).equals(month)),
                MoneyUtils.percent(occupied, db.rooms().size()));

        return new DashboardSummary(
                today,
                kpis,
                sources,
                roomTypes,
                housekeeping,
                db.reservations().stream()
                        .sorted(Comparator.comparing(Reservation::getCreatedAt).reversed())
                        .limit(LIST_LIMIT)
                        .map(r -> Summaries.toReservationSummary(db, r))
                        .toList(),
                arrivals.stream().map(r -> Summaries.toReservationSummary(db, r)).toList(),
                departures.stream().map(r -> Summaries.toReservationSummary(db, r)).toList(),
                transactions);
    }

    /** Completed revenue for the last 7 days and the last 6 calendar months, including today. */
    public static RevenueSeries revenue(HotelData db, LocalDate today) {
        List<RevenuePoint> daily = IntStream.rangeClosed(-6, 0).mapToObj(today::plusDays)
                .map(date -> new RevenuePoint(date.toString(),
                        Summaries.completedRevenue(db.payments(), p -> p.getPaymentDate().toLocalDate().equals(date))))
                .toList();
        YearMonth current = YearMonth.from(today);
        List<RevenuePoint> monthly = IntStream.rangeClosed(-5, 0).mapToObj(current::plusMonths)
                .map(month -> new RevenuePoint(month.toString(),
                        Summaries.completedRevenue(db.payments(), p -> YearMonth.from(p.getPaymentDate()).equals(month))))
                .toList();
        return new RevenueSeries(daily, monthly);
    }

    /** Rooms used on each of the last {@code nights} nights (a night belongs to its start date). */
    public static OccupancySeries occupancy(HotelData db, LocalDate today, int nights) {
        int totalRooms = db.rooms().size();
        List<Reservation> stays = db.reservations().stream().filter(r -> STAYED_STATUSES.contains(r.getStatus())).toList();
        return new OccupancySeries(IntStream.range(0, nights).mapToObj(i -> today.plusDays((long) i - nights)).map(date -> {
            int occupied = stays.stream()
                    .filter(r -> !r.getCheckIn().isAfter(date) && date.isBefore(r.getCheckOut()))
                    .map(Reservation::getRoomId)
                    .collect(Collectors.toSet())
                    .size();
            return new OccupancyPoint(date, occupied, totalRooms, MoneyUtils.percent(occupied, totalRooms));
        }).toList());
    }

    private static int countRooms(HotelData db, RoomStatus status) {
        return (int) db.rooms().stream().filter(r -> r.getStatus() == status).count();
    }

    private static int countTasks(List<HousekeepingTask> tasks, HousekeepingStatus status) {
        return (int) tasks.stream().filter(t -> t.getStatus() == status).count();
    }
}
