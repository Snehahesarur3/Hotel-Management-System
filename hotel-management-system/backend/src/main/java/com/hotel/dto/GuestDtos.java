package com.hotel.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.entity.Guest;
import com.hotel.enums.IdProofType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** /api/guests (frontend types/guest.ts). */
public final class GuestDtos {

    private GuestDtos() {
    }

    /**
     * Body of POST /api/guests and PUT /api/guests/{id}.
     * {@code idProofNumber} is the full number as typed; only a masked form (last 4 characters) is stored.
     * On update, leave it empty to keep the stored value.
     */
    public record GuestInput(
            String fullName,
            String email,
            String phone,
            String address,
            String nationality,
            IdProofType idProofType,
            String idProofNumber) {
    }

    /**
     * A guest with values derived from reservations (flat JSON: the guest's fields plus these).
     *
     * @param previousBookingCount completed (checked-out) stays
     * @param lastStay             check-in date of the most recent non-cancelled reservation
     */
    public record GuestSummary(
            @JsonUnwrapped Guest guest,
            int previousBookingCount,
            @JsonInclude(JsonInclude.Include.ALWAYS) LocalDate lastStay) {
    }

    public record GuestStats(
            int totalReservations,
            int completedStays,
            int upcomingStays,
            int cancelled,
            int nightsStayed,
            BigDecimal totalSpent) {
    }

    /** GET /api/guests/{id}/history */
    public record GuestHistory(GuestStats stats, List<ReservationSummary> reservations) {
    }
}
