package com.hotel.service;

import com.hotel.dto.DashboardDtos.DashboardSummary;
import com.hotel.dto.DashboardDtos.OccupancySeries;
import com.hotel.dto.DashboardDtos.RevenueSeries;

/** GET /api/dashboard/*: figures derived from the live data. */
public interface DashboardService {

    DashboardSummary summary();

    /** Last 7 days and last 6 months of completed revenue. */
    RevenueSeries revenue();

    /** Rooms used on each of the last 30 nights. */
    OccupancySeries occupancy();
}
