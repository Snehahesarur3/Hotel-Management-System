package com.hotel.service;

import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.dto.ListQuery;
import com.hotel.dto.ReservationDtos.AvailableRoom;
import com.hotel.dto.ReservationDtos.ReservationInput;
import com.hotel.enums.BookingSource;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.RoomStatus;
import com.hotel.exception.ApiException;
import com.hotel.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static com.hotel.support.ApiAssertions.invalid;
import static com.hotel.support.ApiAssertions.rejected;
import static org.assertj.core.api.Assertions.assertThat;

class ReservationServiceTest extends IntegrationTest {

    @Autowired
    private ReservationService reservations;

    @Autowired
    private RoomService rooms;

    private static ReservationInput booking(String roomId, int fromToday, int toToday, int guests) {
        return new ReservationInput("GST-0003", roomId, TODAY.plusDays(fromToday).toString(), TODAY.plusDays(toToday).toString(),
                guests, BookingSource.PHONE, BookingStatus.CONFIRMED);
    }

    @Test
    void bookingForTodayLocksTheRateAndHoldsTheRoom() {
        ReservationSummary created = reservations.create(booking("RM-101", 0, 2, 2));
        assertThat(created.id()).isEqualTo("BK-0041");
        assertThat(created.nights()).isEqualTo(2);
        assertThat(created.totalAmount()).isEqualByComparingTo("7000");
        assertThat(rooms.get("RM-101").getStatus()).isEqualTo(RoomStatus.RESERVED);

        // A later tariff change does not touch the booking.
        var room = rooms.get("RM-101");
        rooms.update("RM-101", new com.hotel.dto.RoomDtos.RoomInput("101", 1, room.getType(), room.getCapacity(), new BigDecimal("4200"),
                room.getAmenities(), RoomStatus.RESERVED, room.getDescription()));
        assertThat(reservations.get("BK-0041").roomRate()).isEqualByComparingTo("3500");

        // Cancelling releases the room.
        reservations.cancel("BK-0041");
        assertThat(rooms.get("RM-101").getStatus()).isEqualTo(RoomStatus.AVAILABLE);
    }

    @Test
    void preventsDoubleBookingButAllowsBackToBackStays() {
        // RM-104 is booked by BK-0027 for tonight and tomorrow.
        rejected(() -> reservations.create(booking("RM-104", 1, 3, 2)), 409,
                "Room 104 is already booked 11 Nov – 13 Nov (BK-0027)");
        ReservationSummary next = reservations.create(booking("RM-104", 2, 4, 2));
        assertThat(next.checkIn()).isEqualTo(TODAY.plusDays(2));
    }

    @Test
    void concurrentRequestsCannotDoubleBookARoom() throws Exception {
        int attempts = 8;
        ExecutorService pool = Executors.newFixedThreadPool(attempts);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> results = new ArrayList<>();
        for (int i = 0; i < attempts; i++) {
            results.add(pool.submit(() -> {
                start.await();
                try {
                    reservations.create(booking("RM-201", 3, 5, 2));
                    return true;
                } catch (ApiException e) {
                    return false;
                }
            }));
        }
        start.countDown();
        int booked = 0;
        for (Future<Boolean> result : results) {
            booked += result.get(10, TimeUnit.SECONDS) ? 1 : 0;
        }
        pool.shutdown();
        assertThat(booked).isEqualTo(1);
        assertThat(reservations.list(new ListQuery(0, 50, null, null), null, null, TODAY.plusDays(3).toString(), TODAY.plusDays(4).toString())
                .content().stream().filter(r -> r.roomId().equals("RM-201")).count()).isEqualTo(1);
    }

    @Test
    void checksPartySizeMaintenanceAndDates() {
        invalid(() -> reservations.create(booking("RM-101", 1, 2, 3)), Map.of("numberOfGuests", "Room 101 sleeps at most 2 guests"));
        rejected(() -> reservations.create(booking("RM-110", 1, 2, 1)), 409, "Room 110 is under maintenance and cannot be booked");
        invalid(() -> reservations.create(booking("RM-101", -1, 2, 1)), Map.of("checkIn", "Check-in cannot be before 11 Nov 2026"));
        invalid(() -> reservations.create(booking("RM-101", 2, 2, 1)), Map.of("checkOut", "Check-out must be after check-in"));
        invalid(() -> reservations.create(booking("RM-101", 1, 32, 1)), Map.of("checkOut", "A booking can cover at most 30 nights"));
        invalid(() -> reservations.create(new ReservationInput("", "", "2026-13-01", "", null, null, BookingStatus.CHECKED_IN)), Map.of(
                "guestId", "Select a guest",
                "roomId", "Select an available room",
                "checkIn", "Use the format yyyy-mm-dd",
                "checkOut", "Select the check-out date",
                "numberOfGuests", "Enter the number of guests",
                "source", "Select a booking source",
                "status", "Select Pending or Confirmed"));
    }

    @Test
    void editsKeepTheRateOnTheSameRoomAndReLockOnAMove() {
        ReservationSummary moved = reservations.update("BK-0030", new ReservationInput("GST-0018", "RM-201", TODAY.plusDays(3).toString(),
                TODAY.plusDays(6).toString(), 2, BookingSource.WEBSITE, BookingStatus.CONFIRMED));
        assertThat(moved.nights()).isEqualTo(3);
        assertThat(reservations.get("BK-0030").roomRate()).isEqualByComparingTo(rooms.get("RM-201").getPricePerNight());

        rejected(() -> reservations.update("BK-0013", booking("RM-102", 0, 1, 2)), 409,
                "BK-0013 is checked in and cannot be edited. Changes to an in-house stay are made at the front desk.");
        rejected(() -> reservations.cancel("BK-0037"), 409, "BK-0037 is cancelled and cannot be cancelled. It is already cancelled.");
    }

    @Test
    void listsAvailabilityWithQuotes() {
        List<AvailableRoom> free = reservations.availability(TODAY.plusDays(1).toString(), TODAY.plusDays(3).toString(), 5, null, null);
        assertThat(free).isNotEmpty().allMatch(a -> a.room().getCapacity() >= 5);
        AvailableRoom first = free.getFirst();
        assertThat(first.quote().nights()).isEqualTo(2);
        assertThat(first.quote().gstPercent()).isEqualTo(18); // above ₹7,500 a night
        assertThat(free).noneMatch(a -> a.room().getId().equals("RM-509")); // occupied by a party of 5

        invalid(() -> reservations.availability("", "2026-11-12", 0, null, null),
                Map.of("checkIn", "Select the check-in date", "guests", "Enter 1–10 guests"));
    }

    @Test
    void filtersStaysOverlappingADateRange() {
        var today = reservations.list(new ListQuery(0, 100, null, null), BookingStatus.CHECKED_IN, null, TODAY.toString(), TODAY.toString());
        assertThat(today.totalElements()).isEqualTo(14);
        var byGuest = reservations.list(new ListQuery(0, 100, "aarav", "checkIn,asc"), null, null, null, null);
        assertThat(byGuest.content()).extracting(ReservationSummary::guestName).containsOnly("Aarav Mehta");
    }
}
