package com.hotel.dto;

import com.hotel.enums.BookingSource;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.HousekeepingTaskType;
import com.hotel.enums.PaymentMethod;
import com.hotel.enums.PaymentStatus;
import com.hotel.enums.RoomType;
import com.hotel.enums.TaskPriority;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Responses of GET /api/dashboard/* and the summaries shared by other modules (frontend types/dashboard.ts). */
public final class DashboardDtos {

    private DashboardDtos() {
    }

    /**
     * A booking with its guest and room resolved; used by every list of stays.
     *
     * @param totalAmount room charges: nightly rate x nights, before tax
     */
    public record ReservationSummary(
            String id,
            String guestId,
            String guestName,
            String roomId,
            String roomNumber,
            RoomType roomType,
            LocalDate checkIn,
            LocalDate checkOut,
            int nights,
            int numberOfGuests,
            BigDecimal totalAmount,
            BookingSource source,
            BookingStatus status,
            LocalDateTime createdAt) {
    }

    public record HousekeepingTaskSummary(
            String id,
            String roomNumber,
            HousekeepingTaskType taskType,
            TaskPriority priority,
            LocalDate scheduledDate,
            String assignee,
            HousekeepingStatus status) {
    }

    public record TransactionSummary(
            String id,
            String reservationId,
            String guestName,
            BigDecimal amount,
            PaymentMethod method,
            PaymentStatus status,
            LocalDateTime paymentDate) {
    }

    /**
     * @param totalRevenue  sum of completed payments, all time
     * @param occupancyRate occupied rooms / total rooms x 100, one decimal
     */
    public record DashboardKpis(
            int totalRooms,
            int availableRooms,
            int occupiedRooms,
            int reservedRooms,
            int cleaningRooms,
            int maintenanceRooms,
            int todaysCheckIns,
            int todaysCheckOuts,
            BigDecimal totalRevenue,
            BigDecimal revenueThisMonth,
            double occupancyRate) {
    }

    public record HousekeepingOverview(int pending, int inProgress, int completed, List<HousekeepingTaskSummary> openTasks) {
    }

    public record CategoryCount<K>(K key, int count) {
    }

    public record RoomTypeBreakdown(RoomType type, int total, int occupied) {
    }

    public record DashboardSummary(
            LocalDate asOf,
            DashboardKpis kpis,
            List<CategoryCount<BookingSource>> bookingSources,
            List<RoomTypeBreakdown> roomTypes,
            HousekeepingOverview housekeeping,
            List<ReservationSummary> recentReservations,
            List<ReservationSummary> todaysCheckIns,
            List<ReservationSummary> todaysCheckOuts,
            List<TransactionSummary> recentTransactions) {
    }

    /** @param period yyyy-MM-dd for daily points, yyyy-MM for monthly points */
    public record RevenuePoint(String period, BigDecimal amount) {
    }

    public record RevenueSeries(List<RevenuePoint> daily, List<RevenuePoint> monthly) {
    }

    public record OccupancyPoint(LocalDate date, int occupiedRooms, int totalRooms, double rate) {
    }

    public record OccupancySeries(List<OccupancyPoint> nights) {
    }
}
