package com.hotel.service;

import com.hotel.dto.BillingDtos.StayBill;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.dto.FrontDeskDtos.CheckInInput;
import com.hotel.dto.FrontDeskDtos.CheckInPreview;
import com.hotel.dto.FrontDeskDtos.CheckOutInput;
import com.hotel.dto.FrontDeskDtos.CheckOutResult;
import com.hotel.dto.FrontDeskDtos.FrontDeskOverview;

/** /api/front-desk: arrivals, check-in and check-out. */
public interface FrontDeskService {

    FrontDeskOverview overview();

    /** ID type on file and the rooms that can be assigned. */
    CheckInPreview checkInPreview(String reservationId);

    ReservationSummary checkIn(String reservationId, CheckInInput input);

    /** Final bill if the guest leaves today. */
    StayBill checkOutPreview(String reservationId);

    /** Settles any balance through the payment gateway, checks out and schedules the cleaning. */
    CheckOutResult checkOut(String reservationId, CheckOutInput input);
}
