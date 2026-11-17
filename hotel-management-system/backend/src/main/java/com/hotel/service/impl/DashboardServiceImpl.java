package com.hotel.service.impl;

import com.hotel.calculation.DashboardCalculator;
import com.hotel.dto.DashboardDtos.DashboardSummary;
import com.hotel.dto.DashboardDtos.OccupancySeries;
import com.hotel.dto.DashboardDtos.RevenueSeries;
import com.hotel.service.DashboardService;
import com.hotel.store.DataStore;
import com.hotel.store.HotelClock;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Dashboard figures (rules in {@link DashboardCalculator}). */
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private static final int OCCUPANCY_NIGHTS = 30;

    private final DataStore store;
    private final HotelClock clock;

    @Override
    public DashboardSummary summary() {
        return store.read(db -> DashboardCalculator.summary(db, clock.today()));
    }

    @Override
    public RevenueSeries revenue() {
        return store.read(db -> DashboardCalculator.revenue(db, clock.today()));
    }

    @Override
    public OccupancySeries occupancy() {
        return store.read(db -> DashboardCalculator.occupancy(db, clock.today(), OCCUPANCY_NIGHTS));
    }
}
