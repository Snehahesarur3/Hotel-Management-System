package com.hotel.service;

import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.dto.ReservationDtos.AvailableRoom;
import com.hotel.dto.ReservationDtos.ReservationDetails;
import com.hotel.dto.ReservationDtos.ReservationInput;
import com.hotel.enums.BookingSource;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.RoomType;

import java.util.List;

/** /api/reservations: bookings, availability and cancellations. */
public interface ReservationService {

    /** {@code from}/{@code to} (yyyy-MM-dd) select stays in the hotel at any point of the range. */
    PageResponse<ReservationSummary> list(ListQuery query, BookingStatus status, BookingSource source, String from, String to);

    ReservationDetails get(String id);

    /** Bookable rooms for the dates and party, with quotes; {@code excludeReservationId} ignores the booking being edited. */
    List<AvailableRoom> availability(String checkIn, String checkOut, Integer guests, RoomType type, String excludeReservationId);

    ReservationSummary create(ReservationInput input);

    /** Pending and confirmed bookings only. */
    ReservationSummary update(String id, ReservationInput input);

    /** Pending and confirmed bookings only. */
    ReservationSummary cancel(String id);
}
