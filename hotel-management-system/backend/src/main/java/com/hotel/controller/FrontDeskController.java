package com.hotel.controller;

import com.hotel.dto.BillingDtos.StayBill;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.dto.FrontDeskDtos.CheckInInput;
import com.hotel.dto.FrontDeskDtos.CheckInPreview;
import com.hotel.dto.FrontDeskDtos.CheckOutInput;
import com.hotel.dto.FrontDeskDtos.CheckOutResult;
import com.hotel.dto.FrontDeskDtos.FrontDeskOverview;
import com.hotel.service.FrontDeskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Front desk", description = "Arrivals, check-in and check-out")
@RestController
@RequestMapping("/api/front-desk")
@RequiredArgsConstructor
public class FrontDeskController {

    private final FrontDeskService frontDesk;

    @Operation(summary = "Today's arrivals, in-house guests and departures")
    @GetMapping("/overview")
    public FrontDeskOverview overview() {
        return frontDesk.overview();
    }

    @Operation(summary = "ID type on file and the rooms that can be assigned")
    @GetMapping("/check-in/{reservationId}")
    public CheckInPreview checkInPreview(@PathVariable String reservationId) {
        return frontDesk.checkInPreview(reservationId);
    }

    @Operation(summary = "Check in after verifying the last 4 characters of the guest's ID")
    @PostMapping("/check-in/{reservationId}")
    public ReservationSummary checkIn(@PathVariable String reservationId, @RequestBody CheckInInput input) {
        return frontDesk.checkIn(reservationId, input);
    }

    @Operation(summary = "Final bill if the guest leaves today")
    @GetMapping("/check-out/{reservationId}")
    public StayBill checkOutPreview(@PathVariable String reservationId) {
        return frontDesk.checkOutPreview(reservationId);
    }

    @Operation(summary = "Settle the balance (mock gateway), check out and schedule the cleaning")
    @PostMapping("/check-out/{reservationId}")
    public CheckOutResult checkOut(@PathVariable String reservationId, @RequestBody(required = false) CheckOutInput input) {
        return frontDesk.checkOut(reservationId, input == null ? new CheckOutInput(null) : input);
    }
}
