package com.sneha.hotel.controller;

import com.sneha.hotel.dto.BookingRequest;
import com.sneha.hotel.dto.BookingResponse;
import com.sneha.hotel.dto.DashboardResponse;
import com.sneha.hotel.service.BookingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping
    public ResponseEntity<BookingResponse> create(@Valid @RequestBody BookingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(bookingService.createBooking(request));
    }

    @GetMapping
    public List<BookingResponse> getAll() {
        return bookingService.getAll();
    }

    @GetMapping("/{id}")
    public BookingResponse getOne(@PathVariable Long id) {
        return bookingService.get(id);
    }

    // PATCH = partial update: only the status changes
    @PatchMapping("/{id}/cancel")
    public BookingResponse cancel(@PathVariable Long id) {
        return bookingService.cancel(id);
    }

    @PatchMapping("/{id}/check-in")
    public BookingResponse checkIn(@PathVariable Long id) {
        return bookingService.checkIn(id);
    }

    @PatchMapping("/{id}/check-out")
    public BookingResponse checkOut(@PathVariable Long id) {
        return bookingService.checkOut(id);
    }

    @GetMapping("/dashboard")
    public DashboardResponse dashboard() {
        return bookingService.dashboard();
    }
}
