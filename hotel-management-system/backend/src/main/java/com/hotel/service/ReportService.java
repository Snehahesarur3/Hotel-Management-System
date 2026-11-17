package com.hotel.service;

import com.hotel.dto.ReportDtos.GuestReport;
import com.hotel.dto.ReportDtos.OccupancyReport;
import com.hotel.dto.ReportDtos.PaymentReport;
import com.hotel.dto.ReportDtos.ReservationReport;
import com.hotel.dto.ReportDtos.RevenueReport;
import com.hotel.enums.ReportGrouping;

/** /api/reports: read-only analytics over an inclusive date range (from/to as yyyy-MM-dd, at most 731 days). */
public interface ReportService {

    /** Daily grouping covers at most 93 days. */
    RevenueReport revenue(String from, String to, ReportGrouping groupBy);

    OccupancyReport occupancy(String from, String to);

    /** By arrival (check-in) date. */
    ReservationReport reservations(String from, String to);

    /** Guests with a non-cancelled stay arriving in the range. */
    GuestReport guests(String from, String to);

    /** By payment date, any status. */
    PaymentReport payments(String from, String to);
}
