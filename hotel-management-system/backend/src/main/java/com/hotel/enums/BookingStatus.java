package com.hotel.enums;

/** Reservation lifecycle: PENDING -> CONFIRMED -> CHECKED_IN -> CHECKED_OUT, or -> CANCELLED. */
public enum BookingStatus {
    PENDING,
    CONFIRMED,
    CHECKED_IN,
    CHECKED_OUT,
    CANCELLED
}
