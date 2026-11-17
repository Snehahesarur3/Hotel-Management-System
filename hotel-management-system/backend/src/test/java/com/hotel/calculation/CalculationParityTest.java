package com.hotel.calculation;

import com.hotel.dto.DashboardDtos.DashboardSummary;
import com.hotel.dto.ReportDtos.GuestReport;
import com.hotel.dto.ReportDtos.OccupancyReport;
import com.hotel.dto.ReportDtos.PaymentReport;
import com.hotel.dto.ReportDtos.ReportRange;
import com.hotel.dto.ReportDtos.ReservationReport;
import com.hotel.dto.ReportDtos.RevenueReport;
import com.hotel.enums.BookingSource;
import com.hotel.enums.PaymentMethod;
import com.hotel.enums.ReportGrouping;
import com.hotel.store.HotelData;
import com.hotel.support.SeedFixture;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The backend must produce exactly the figures the frontend mock services produce from the same seed.
 * Every expected value here is also asserted by a frontend test
 * (mock/calculations/dashboard.test.ts and reports.test.ts, both at 2026-11-11).
 */
class CalculationParityTest {

    private static final LocalDate TODAY = SeedFixture.TODAY;
    private static final ReportRange LAST_30 = new ReportRange(LocalDate.of(2026, 10, 13), TODAY);
    private final HotelData db = SeedFixture.load();

    private static BigDecimal money(String value) {
        return new BigDecimal(value);
    }

    @Test
    void dashboardKpisMatchTheFrontend() {
        DashboardSummary summary = DashboardCalculator.summary(db, TODAY);
        assertThat(summary.kpis().totalRooms()).isEqualTo(50);
        assertThat(summary.kpis().availableRooms()).isEqualTo(29);
        assertThat(summary.kpis().occupiedRooms()).isEqualTo(14);
        assertThat(summary.kpis().reservedRooms()).isEqualTo(3);
        assertThat(summary.kpis().cleaningRooms()).isEqualTo(2);
        assertThat(summary.kpis().maintenanceRooms()).isEqualTo(2);
        assertThat(summary.kpis().occupancyRate()).isEqualTo(28.0);
        assertThat(summary.kpis().todaysCheckIns()).isEqualTo(4);
        assertThat(summary.kpis().todaysCheckOuts()).isEqualTo(5);
        assertThat(summary.todaysCheckOuts()).extracting("id")
                .containsExactlyInAnyOrder("BK-0001", "BK-0002", "BK-0015", "BK-0016", "BK-0020");
        assertThat(summary.kpis().totalRevenue()).isEqualByComparingTo(money("287095.5"));
    }

    @Test
    void revenueReportMatchesTheFrontend() {
        RevenueReport report = ReportCalculator.revenue(db, LAST_30, ReportGrouping.MONTH);
        assertThat(report.totals().collected()).isEqualByComparingTo(money("157265.5"));
        assertThat(report.totals().refunded()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(report.totals().transactions()).isEqualTo(15);
        assertThat(report.totals().averagePerDay()).isEqualByComparingTo(money("5242.18"));
        assertThat(report.periods()).extracting("period").containsExactly("2026-10", "2026-11");
        assertThat(report.bySource().getFirst().key()).isEqualTo(BookingSource.CORPORATE);
        assertThat(report.bySource().getFirst().net()).isEqualByComparingTo(money("38400"));
        assertThat(report.bySource().getFirst().share()).isEqualTo(24.4);

        assertThat(report.charges().stays()).isEqualTo(6);
        assertThat(report.charges().roomCharges()).isEqualByComparingTo(money("89000"));
        assertThat(report.charges().foodCharges()).isEqualByComparingTo(money("4710"));
        assertThat(report.charges().tax()).isEqualByComparingTo(money("13795.5"));
        assertThat(report.charges().total()).isEqualByComparingTo(money("107505.5"));

        assertThat(ReportCalculator.revenue(db, LAST_30, ReportGrouping.DAY).periods()).hasSize(30);
    }

    @Test
    void occupancyReportMatchesTheFrontend() {
        OccupancyReport report = ReportCalculator.occupancy(db, LAST_30, TODAY);
        assertThat(report.totals().nights()).isEqualTo(30);
        assertThat(report.totals().roomNightsAvailable()).isEqualTo(1500);
        assertThat(report.totals().roomNightsSold()).isEqualTo(60);
        assertThat(report.totals().occupancyRate()).isEqualTo(4.0);
        assertThat(report.totals().roomRevenue()).isEqualByComparingTo(money("435500"));
        assertThat(report.totals().averageDailyRate()).isEqualByComparingTo(money("7258.33"));
        assertThat(report.totals().revPar()).isEqualByComparingTo(money("290.33"));
        assertThat(report.totals().forecastFrom()).isEqualTo(TODAY);
        assertThat(report.rooms().getFirst().roomNumber()).isEqualTo("306");
        assertThat(report.rooms().getFirst().occupancyRate()).isEqualTo(16.7);
    }

    @Test
    void reservationReportMatchesTheFrontend() {
        ReservationReport report = ReportCalculator.reservations(db, LAST_30);
        assertThat(report.totals().reservations()).isEqualTo(25);
        assertThat(report.totals().cancelled()).isEqualTo(2);
        assertThat(report.totals().cancellationRate()).isEqualTo(8.0);
        assertThat(report.totals().roomNights()).isEqualTo(77);
        assertThat(report.totals().roomRevenue()).isEqualByComparingTo(money("583500"));
        assertThat(report.totals().averageStay()).isEqualTo(3.3);
        assertThat(report.totals().averageLeadTime()).isEqualTo(18.0);
        assertThat(report.totals().averageGuests()).isEqualTo(2.0);
        assertThat(report.bySource().getFirst().key()).isEqualTo(BookingSource.WEBSITE);
    }

    @Test
    void guestReportMatchesTheFrontend() {
        GuestReport report = ReportCalculator.guests(db, LAST_30);
        assertThat(report.totals().guests()).isEqualTo(21);
        assertThat(report.totals().stays()).isEqualTo(23);
        assertThat(report.totals().averageRevenuePerGuest()).isEqualByComparingTo(money("27785.71"));
        assertThat(report.guests().getFirst().guestName()).isEqualTo("Omar Haddad");
        assertThat(report.byNationality().getFirst().key()).isEqualTo("Indian");
        assertThat(report.byNationality().getFirst().guests()).isEqualTo(13);
    }

    @Test
    void paymentReportMatchesTheFrontend() {
        PaymentReport report = ReportCalculator.payments(db, LAST_30);
        assertThat(report.totals().transactions()).isEqualTo(18);
        assertThat(report.totals().pendingAmount()).isEqualByComparingTo(money("25000"));
        assertThat(report.totals().failedAmount()).isEqualByComparingTo(money("6160"));
        assertThat(report.byMethod().getFirst().key()).isEqualTo(PaymentMethod.CREDIT_CARD);
        assertThat(report.byMethod().getFirst().share()).isEqualTo(30.4);
        assertThat(report.rows()).hasSize(18);
    }
}
