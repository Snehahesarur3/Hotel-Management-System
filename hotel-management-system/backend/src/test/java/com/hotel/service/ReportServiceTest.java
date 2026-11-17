package com.hotel.service;

import com.hotel.enums.ReportGrouping;
import com.hotel.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;

import static com.hotel.support.ApiAssertions.invalid;
import static org.assertj.core.api.Assertions.assertThat;

class ReportServiceTest extends IntegrationTest {

    @Autowired
    private ReportService reports;

    @Autowired
    private DashboardService dashboard;

    @Test
    void validatesRangesWithTheFilterFormMessages() {
        invalid(() -> reports.payments("2026-11-11", "2026-11-10"), Map.of("to", "The end date must be on or after the start date"));
        invalid(() -> reports.occupancy("2024-01-01", "2026-01-01"), Map.of("to", "Reports cover at most 731 days"));
        invalid(() -> reports.guests("2026-02-30", "2026-03-01"), Map.of("from", "Choose a valid start date"));
        invalid(() -> reports.reservations(null, "nope"), Map.of("from", "Choose the start date", "to", "Choose the end date"));
        invalid(() -> reports.revenue("2026-01-01", "2026-06-30", ReportGrouping.DAY), Map.of("groupBy", "Daily breakdowns cover at most 93 days"));
        invalid(() -> reports.revenue("2026-01-01", "2026-01-31", null), Map.of("groupBy", "Choose daily, monthly or yearly"));
    }

    @Test
    void servesTheSameFiguresAsTheCalculations() {
        var report = reports.revenue("2026-10-13", "2026-11-11", ReportGrouping.MONTH);
        assertThat(report.totals().net()).isEqualByComparingTo("157265.5");
        assertThat(reports.occupancy("2026-10-13", "2026-11-11").totals().forecastFrom()).isEqualTo(TODAY);
        assertThat(dashboard.summary().kpis().occupiedRooms()).isEqualTo(14);
        assertThat(dashboard.revenue().daily()).hasSize(7);
        assertThat(dashboard.occupancy().nights()).hasSize(30).last().extracting("date").isEqualTo(TODAY.minusDays(1));
    }
}
