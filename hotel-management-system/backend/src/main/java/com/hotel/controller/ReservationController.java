package com.hotel.controller;

import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.dto.ReservationDtos.AvailableRoom;
import com.hotel.dto.ReservationDtos.ReservationDetails;
import com.hotel.dto.ReservationDtos.ReservationInput;
import com.hotel.enums.BookingSource;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.RoomType;
import com.hotel.service.ReservationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Reservations", description = "Bookings, availability and cancellations")
@RestController
@RequestMapping("/api/reservations")
@RequiredArgsConstructor
public class ReservationController {

    private final ReservationService reservations;

    @Operation(summary = "List bookings; from/to select stays in the hotel at any point of the range")
    @GetMapping
    public PageResponse<ReservationSummary> list(ListQuery query,
                                                 @RequestParam(required = false) BookingStatus status,
                                                 @RequestParam(required = false) BookingSource source,
                                                 @RequestParam(required = false) String from,
                                                 @RequestParam(required = false) String to) {
        return reservations.list(query, status, source, from, to);
    }

    @Operation(summary = "Bookable rooms for the dates and party size, with quotes")
    @GetMapping("/availability")
    public List<AvailableRoom> availability(@RequestParam(required = false) String checkIn,
                                            @RequestParam(required = false) String checkOut,
                                            @RequestParam(required = false) Integer guests,
                                            @RequestParam(required = false) RoomType type,
                                            @RequestParam(required = false) String excludeReservationId) {
        return reservations.availability(checkIn, checkOut, guests, type, excludeReservationId);
    }

    @Operation(summary = "Booking with guest contact, charges and payments")
    @GetMapping("/{id}")
    public ReservationDetails get(@PathVariable String id) {
        return reservations.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReservationSummary create(@RequestBody ReservationInput input) {
        return reservations.create(input);
    }

    @Operation(summary = "Edit a pending or confirmed booking")
    @PutMapping("/{id}")
    public ReservationSummary update(@PathVariable String id, @RequestBody ReservationInput input) {
        return reservations.update(id, input);
    }

    @Operation(summary = "Cancel a pending or confirmed booking")
    @PostMapping("/{id}/cancel")
    public ReservationSummary cancel(@PathVariable String id) {
        return reservations.cancel(id);
    }
}
