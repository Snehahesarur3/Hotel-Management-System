package com.hotel.controller;

import com.hotel.dto.DashboardDtos.DashboardSummary;
import com.hotel.dto.DashboardDtos.OccupancySeries;
import com.hotel.dto.DashboardDtos.RevenueSeries;
import com.hotel.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Dashboard", description = "KPIs and charts derived from the live data")
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboard;

    @Operation(summary = "KPIs, today's arrivals and departures, recent activity")
    @GetMapping("/summary")
    public DashboardSummary summary() {
        return dashboard.summary();
    }

    @Operation(summary = "Completed revenue: last 7 days and last 6 months")
    @GetMapping("/revenue")
    public RevenueSeries revenue() {
        return dashboard.revenue();
    }

    @Operation(summary = "Rooms used on each of the last 30 nights")
    @GetMapping("/occupancy")
    public OccupancySeries occupancy() {
        return dashboard.occupancy();
    }
}
