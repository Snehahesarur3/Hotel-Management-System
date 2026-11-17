package com.hotel.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.entity.Payment;
import com.hotel.entity.Room;
import com.hotel.enums.BookingSource;
import com.hotel.enums.BookingStatus;

import java.math.BigDecimal;
import java.util.List;

/** /api/reservations (frontend types/reservation.ts). */
public final class ReservationDtos {

    private ReservationDtos() {
    }

    /**
     * Body of POST /api/reservations and PUT /api/reservations/{id}. Dates are yyyy-MM-dd text, validated
     * with field messages. The nightly rate is not sent: it is locked in from the room's tariff.
     * {@code status} may only be PENDING or CONFIRMED.
     */
    public record ReservationInput(
            String guestId,
            String roomId,
            String checkIn,
            String checkOut,
            Integer numberOfGuests,
            BookingSource source,
            BookingStatus status) {
    }

    /** Room charges for a stay at a fixed rate; GST follows the slab for the nightly rate. */
    public record StayQuote(
            int nights,
            BigDecimal roomRate,
            BigDecimal roomCharges,
            int gstPercent,
            BigDecimal gstAmount,
            BigDecimal total) {
    }

    public record AvailableRoom(Room room, StayQuote quote) {
    }

    /**
     * GET /api/reservations/{id}
     *
     * @param payments   newest first
     * @param amountPaid sum of completed payments
     */
    public record ReservationDetails(
            @JsonUnwrapped ReservationSummary summary,
            BigDecimal roomRate,
            int roomFloor,
            int roomCapacity,
            String guestEmail,
            String guestPhone,
            StayQuote quote,
            List<Payment> payments,
            BigDecimal amountPaid) {
    }
}
