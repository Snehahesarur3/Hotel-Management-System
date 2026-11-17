package com.hotel.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.hotel.dto.DashboardDtos.HousekeepingTaskSummary;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.enums.RoomStatus;
import com.hotel.enums.RoomType;

import java.math.BigDecimal;
import java.util.List;

/** /api/rooms (frontend types/room.ts). */
public final class RoomDtos {

    private RoomDtos() {
    }

    /** Body of POST /api/rooms and PUT /api/rooms/{id}. */
    public record RoomInput(
            String roomNumber,
            Integer floor,
            RoomType type,
            Integer capacity,
            BigDecimal pricePerNight,
            List<String> amenities,
            RoomStatus status,
            String description) {
    }

    /** Body of PATCH /api/rooms/{id}/status. */
    public record RoomStatusUpdate(RoomStatus status) {
    }

    /** GET /api/rooms/{id}/activity */
    public record RoomActivity(
            @JsonInclude(JsonInclude.Include.ALWAYS) ReservationSummary currentStay,
            List<ReservationSummary> upcoming,
            List<ReservationSummary> history,
            List<HousekeepingTaskSummary> housekeeping) {
    }
}
