package com.sneha.hotel.dto;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/** What the client sends to create a booking. A record = immutable DTO with auto-generated getters. */
public record BookingRequest(
        @NotNull(message = "roomId is required") Long roomId,
        @NotNull(message = "customerId is required") Long customerId,
        @NotNull @FutureOrPresent(message = "Check-in cannot be in the past") LocalDate checkIn,
        @NotNull LocalDate checkOut,
        @Min(value = 1, message = "At least 1 guest") int guests
) {}
