package com.hotel.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.hotel.dto.BillingDtos.StayBill;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.entity.Payment;
import com.hotel.entity.Room;
import com.hotel.enums.IdProofType;
import com.hotel.enums.PaymentMethod;

import java.time.LocalDate;
import java.util.List;

/** /api/front-desk (frontend types/frontDesk.ts). */
public final class FrontDeskDtos {

    private FrontDeskDtos() {
    }

    /** GET /api/front-desk/overview */
    public record FrontDeskOverview(
            LocalDate date,
            List<ReservationSummary> arrivals,
            List<ReservationSummary> inHouse,
            List<ReservationSummary> departures) {
    }

    /** @param reason why the room cannot be handed over now (absent when ready) */
    public record CheckInRoomOption(Room room, boolean booked, boolean ready, String reason) {
    }

    /** GET /api/front-desk/check-in/{reservationId}. The ID number itself is never sent. */
    public record CheckInPreview(
            ReservationSummary reservation,
            IdProofType idProofType,
            boolean lateArrival,
            List<CheckInRoomOption> rooms) {
    }

    /** @param idLast4 last 4 characters read from the guest's ID document */
    public record CheckInInput(String roomId, String idLast4) {
    }

    /** @param paymentMethod required when a balance is due (processed by the mock gateway) */
    public record CheckOutInput(PaymentMethod paymentMethod) {
    }

    public record CheckOutResult(
            ReservationSummary reservation,
            StayBill bill,
            @JsonInclude(JsonInclude.Include.ALWAYS) Payment payment,
            String housekeepingTaskId) {
    }
}
