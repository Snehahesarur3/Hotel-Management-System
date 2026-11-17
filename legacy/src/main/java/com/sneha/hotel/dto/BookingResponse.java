package com.sneha.hotel.dto;

import com.sneha.hotel.entity.Booking;
import com.sneha.hotel.entity.BookingStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

/** What the API returns — we never expose JPA entities directly. */
public record BookingResponse(
        Long bookingId,
        String roomNumber,
        String roomType,
        String customerName,
        String customerEmail,
        LocalDate checkIn,
        LocalDate checkOut,
        int guests,
        long nights,
        BigDecimal totalAmount,
        BookingStatus status
) {
    public static BookingResponse from(Booking b) {
        return new BookingResponse(
                b.getId(),
                b.getRoom().getRoomNumber(),
                b.getRoom().getRoomType().name(),
                b.getCustomer().getName(),
                b.getCustomer().getEmail(),
                b.getCheckIn(),
                b.getCheckOut(),
                b.getGuests(),
                java.time.temporal.ChronoUnit.DAYS.between(b.getCheckIn(), b.getCheckOut()),
                b.getTotalAmount(),
                b.getStatus());
    }
}
