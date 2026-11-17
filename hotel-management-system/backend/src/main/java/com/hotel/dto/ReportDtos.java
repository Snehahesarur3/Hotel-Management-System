package com.hotel.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.hotel.dto.BillingDtos.PaymentRecord;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.enums.BookingSource;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.PaymentMethod;
import com.hotel.enums.PaymentStatus;
import com.hotel.enums.ReportGrouping;
import com.hotel.enums.RoomType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * GET /api/reports/* (frontend types/reports.ts). Every report covers an inclusive date range.
 * Percentages are numbers with one decimal; money has two decimals.
 */
public final class ReportDtos {

    private ReportDtos() {
    }

    public record ReportRange(LocalDate from, LocalDate to) {
    }

    // ------------------------------------------------------------------ revenue

    /**
     * @param period   yyyy-MM-dd, yyyy-MM or yyyy
     * @param refunded completed refunds as a positive amount
     */
    public record RevenuePeriod(String period, BigDecimal collected, BigDecimal refunded, BigDecimal net, int transactions) {
    }

    public record RevenueShare<K>(K key, BigDecimal net, int transactions, double share) {
    }

    /** Folio charges of stays that checked out in the range (accrual view). */
    public record ChargesBreakdown(
            int stays,
            BigDecimal roomCharges,
            BigDecimal discounts,
            BigDecimal foodCharges,
            BigDecimal extraCharges,
            BigDecimal tax,
            BigDecimal total) {
    }

    public record RevenueTotals(BigDecimal collected, BigDecimal refunded, BigDecimal net, int transactions, BigDecimal averagePerDay) {
    }

    public record RevenueReport(
            LocalDate from,
            LocalDate to,
            ReportGrouping groupBy,
            RevenueTotals totals,
            List<RevenuePeriod> periods,
            List<RevenueShare<BookingSource>> bySource,
            List<RevenueShare<RoomType>> byRoomType,
            ChargesBreakdown charges) {
    }

    // ------------------------------------------------------------------ occupancy

    /** @param forecast tonight or later: counts confirmed and pending bookings ("on the books") */
    public record OccupancyNight(LocalDate date, int occupiedRooms, int totalRooms, double rate, BigDecimal roomRevenue, boolean forecast) {
    }

    public record RoomTypePerformance(
            RoomType type,
            int rooms,
            int roomNightsAvailable,
            int roomNightsSold,
            double occupancyRate,
            BigDecimal roomRevenue,
            BigDecimal averageDailyRate,
            BigDecimal revPar) {
    }

    public record RoomPerformance(
            String roomId,
            String roomNumber,
            RoomType type,
            int floor,
            int stays,
            int nightsSold,
            double occupancyRate,
            BigDecimal roomRevenue,
            BigDecimal averageDailyRate) {
    }

    /** @param forecastFrom first forecast night in the range, or null when the range is in the past */
    public record OccupancyTotals(
            int nights,
            int roomNightsAvailable,
            int roomNightsSold,
            double occupancyRate,
            BigDecimal roomRevenue,
            BigDecimal averageDailyRate,
            BigDecimal revPar,
            @JsonInclude(JsonInclude.Include.ALWAYS) LocalDate forecastFrom) {
    }

    public record OccupancyReport(
            LocalDate from,
            LocalDate to,
            OccupancyTotals totals,
            List<OccupancyNight> nights,
            List<RoomTypePerformance> byRoomType,
            List<RoomPerformance> rooms) {
    }

    // ------------------------------------------------------------------ reservations

    public record ReservationTotals(
            int reservations,
            int cancelled,
            double cancellationRate,
            int roomNights,
            BigDecimal roomRevenue,
            double averageStay,
            double averageLeadTime,
            double averageGuests) {
    }

    public record StatusCount(BookingStatus key, int count) {
    }

    public record ReservationSourceRow(BookingSource key, int reservations, int cancelled, int roomNights, BigDecimal roomRevenue) {
    }

    public record ReservationRoomTypeRow(RoomType key, int reservations, int roomNights, BigDecimal roomRevenue) {
    }

    public record ReservationReport(
            LocalDate from,
            LocalDate to,
            ReservationTotals totals,
            List<StatusCount> byStatus,
            List<ReservationSourceRow> bySource,
            List<ReservationRoomTypeRow> byRoomType,
            List<ReservationSummary> rows) {
    }

    // ------------------------------------------------------------------ guests

    /**
     * @param isNew       registered in the range
     * @param isReturning had an earlier stay (checked in or out) arriving before the range
     */
    public record GuestReportRow(
            String guestId,
            String guestName,
            String nationality,
            int stays,
            int nights,
            BigDecimal roomRevenue,
            LocalDate lastArrival,
            boolean isNew,
            boolean isReturning) {
    }

    public record NationalityRow(String key, int guests, int stays, int nights, BigDecimal roomRevenue) {
    }

    public record GuestTotals(int guests, int newGuests, int returningGuests, int stays, BigDecimal roomRevenue,
                              BigDecimal averageRevenuePerGuest) {
    }

    public record GuestReport(
            LocalDate from,
            LocalDate to,
            GuestTotals totals,
            List<NationalityRow> byNationality,
            List<GuestReportRow> guests) {
    }

    // ------------------------------------------------------------------ payments

    public record PaymentMethodRow(PaymentMethod key, int transactions, BigDecimal collected, BigDecimal refunded,
                                   BigDecimal net, double share) {
    }

    public record PaymentStatusRow(PaymentStatus key, int count, BigDecimal amount) {
    }

    public record PaymentTotals(
            int transactions,
            BigDecimal collected,
            BigDecimal refunded,
            BigDecimal net,
            int pendingCount,
            BigDecimal pendingAmount,
            int failedCount,
            BigDecimal failedAmount) {
    }

    public record PaymentReport(
            LocalDate from,
            LocalDate to,
            PaymentTotals totals,
            List<PaymentMethodRow> byMethod,
            List<PaymentStatusRow> byStatus,
            List<PaymentRecord> rows) {
    }
}
