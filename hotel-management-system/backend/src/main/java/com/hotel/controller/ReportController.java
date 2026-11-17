package com.hotel.controller;

import com.hotel.dto.ReportDtos.GuestReport;
import com.hotel.dto.ReportDtos.OccupancyReport;
import com.hotel.dto.ReportDtos.PaymentReport;
import com.hotel.dto.ReportDtos.ReservationReport;
import com.hotel.dto.ReportDtos.RevenueReport;
import com.hotel.enums.ReportGrouping;
import com.hotel.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Every report takes an inclusive range: ?from=yyyy-MM-dd&to=yyyy-MM-dd (at most 731 days). */
@Tag(name = "Reports", description = "Revenue, occupancy, reservation, guest and payment analytics")
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reports;

    @Operation(summary = "Cash revenue by period, source and room type, plus charges billed on departure (DAY covers at most 93 days)")
    @GetMapping("/revenue")
    public RevenueReport revenue(@RequestParam(required = false) String from,
                                 @RequestParam(required = false) String to,
                                 @RequestParam(required = false) ReportGrouping groupBy) {
        return reports.revenue(from, to, groupBy);
    }

    @Operation(summary = "Occupancy, ADR and RevPAR per night, room type and room")
    @GetMapping("/occupancy")
    public OccupancyReport occupancy(@RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return reports.occupancy(from, to);
    }

    @Operation(summary = "Bookings by arrival date")
    @GetMapping("/reservations")
    public ReservationReport reservations(@RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return reports.reservations(from, to);
    }

    @Operation(summary = "Guests with a stay arriving in the range")
    @GetMapping("/guests")
    public GuestReport guests(@RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return reports.guests(from, to);
    }

    @Operation(summary = "Payments and refunds by payment date")
    @GetMapping("/payments")
    public PaymentReport payments(@RequestParam(required = false) String from, @RequestParam(required = false) String to) {
        return reports.payments(from, to);
    }
}
