package com.hotel.service;

import com.hotel.dto.GuestDtos.GuestInput;
import com.hotel.dto.GuestDtos.GuestSummary;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.dto.RoomDtos.RoomInput;
import com.hotel.entity.Room;
import com.hotel.enums.IdProofType;
import com.hotel.enums.RoomStatus;
import com.hotel.enums.RoomType;
import com.hotel.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static com.hotel.support.ApiAssertions.invalid;
import static com.hotel.support.ApiAssertions.rejected;
import static org.assertj.core.api.Assertions.assertThat;

class RoomAndGuestServiceTest extends IntegrationTest {

    @Autowired
    private RoomService rooms;

    @Autowired
    private GuestService guests;

    private static RoomInput room(String number, int floor, RoomStatus status) {
        return new RoomInput(number, floor, RoomType.DELUXE, 2, new BigDecimal("5500"), List.of("Wi-Fi", "Wi-Fi", "Balcony"), status, "Sea view");
    }

    // ------------------------------------------------------------------ rooms

    @Test
    void searchesFiltersSortsAndPagesRooms() {
        PageResponse<Room> suites = rooms.list(new ListQuery(0, 50, "suite", "pricePerNight,desc"), null, null, null);
        assertThat(suites.content()).isNotEmpty().allMatch(r -> r.getType() == RoomType.SUITE);

        PageResponse<Room> floorFive = rooms.list(new ListQuery(0, 3, null, "roomNumber,desc"), 5, null, null);
        assertThat(floorFive.totalElements()).isEqualTo(10);
        assertThat(floorFive.totalPages()).isEqualTo(4);
        assertThat(floorFive.content()).extracting(Room::getRoomNumber).containsExactly("510", "509", "508");

        assertThat(rooms.list(ListQuery.all(), null, null, RoomStatus.RESERVED).content())
                .extracting(Room::getId).containsExactly("RM-104", "RM-304", "RM-408");
        assertThat(rooms.floors()).containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    void createsRoomsWithTheirNumberAsIdAndRejectsDuplicatesAndBadNumbers() {
        Room created = rooms.create(room("111", 1, RoomStatus.AVAILABLE));
        assertThat(created.getId()).isEqualTo("RM-111");
        assertThat(created.getAmenities()).containsExactly("Wi-Fi", "Balcony");

        rejected(() -> rooms.create(room("111", 1, RoomStatus.AVAILABLE)), 409, "Room 111 already exists");
        invalid(() -> rooms.create(room("211", 1, RoomStatus.AVAILABLE)),
                Map.of("roomNumber", "Room numbers on floor 1 look like 101–199"));
        invalid(() -> rooms.create(room("112", 1, RoomStatus.OCCUPIED)),
                Map.of("status", "A new room can only start as Available, Cleaning or Maintenance"));
        invalid(() -> rooms.create(new RoomInput("12", null, null, 0, new BigDecimal("100.555"), null, null, null)), Map.of(
                "roomNumber", "Use 3–4 digits, e.g. 204",
                "floor", "Floor is required",
                "type", "Select a room type",
                "capacity", "At least 1 guest",
                "pricePerNight", "Minimum ₹500 per night",
                "status", "Select a status"));
    }

    @Test
    void protectsWorkflowStatusesAndCapacity() {
        rejected(() -> rooms.updateStatus("RM-102", RoomStatus.MAINTENANCE), 409,
                "Room 102 has a guest in-house. Check the guest out to change its status.");
        rejected(() -> rooms.updateStatus("RM-104", RoomStatus.CLEANING), 409,
                "Room 104 is held for today's arrival (BK-0027). Reassign or cancel that booking first.");
        rejected(() -> rooms.updateStatus("RM-101", RoomStatus.OCCUPIED), 400,
                "Occupied is set automatically by reservations and check-in");
        // Room 509 hosts a party of 5.
        Room presidential = rooms.get("RM-509");
        rejected(() -> rooms.update("RM-509", new RoomInput("509", 5, RoomType.PRESIDENTIAL, 4, presidential.getPricePerNight(),
                presidential.getAmenities(), RoomStatus.OCCUPIED, "")), 409, "An active or upcoming booking has 5 guests; capacity cannot be lower");
    }

    @Test
    void freeingARoomForTodaysArrivalMakesItReserved() {
        // Room 107 is being cleaned; nobody arrives there today, so it becomes Available.
        assertThat(rooms.updateStatus("RM-107", RoomStatus.AVAILABLE).getStatus()).isEqualTo(RoomStatus.AVAILABLE);
        assertThat(rooms.updateStatus("RM-107", RoomStatus.MAINTENANCE).getStatus()).isEqualTo(RoomStatus.MAINTENANCE);
    }

    @Test
    void onlyDeletesRoomsWithoutHistory() {
        rejected(() -> rooms.delete("RM-101"), 409);
        rooms.create(room("111", 1, RoomStatus.AVAILABLE));
        rooms.delete("RM-111");
        rejected(() -> rooms.get("RM-111"), 404, "Room with id 'RM-111' was not found");
    }

    // ------------------------------------------------------------------ guests

    private static GuestInput guest(String email, IdProofType type, String number) {
        return new GuestInput("Neha Kamath", email, "+91 90000 51111", "21 Beach Road, Panaji", "Indian", type, number);
    }

    @Test
    void masksIdentityNumbersAndNeverStoresThemInFull() {
        GuestSummary created = guests.create(guest("NEHA@Example.com", IdProofType.PASSPORT, "n12-34 567"));
        assertThat(created.guest().getIdProofNumber()).isEqualTo("XXXXX4567");
        assertThat(created.guest().getEmail()).isEqualTo("neha@example.com");
        assertThat(created.guest().getRegistrationDate()).isEqualTo(TODAY);
        assertThat(created.previousBookingCount()).isZero();
        assertThat(created.lastStay()).isNull();

        // An empty number on update keeps the stored one; a new document type needs a new number.
        GuestSummary kept = guests.update(created.guest().getId(), guest("neha@example.com", IdProofType.PASSPORT, ""));
        assertThat(kept.guest().getIdProofNumber()).isEqualTo("XXXXX4567");
        invalid(() -> guests.update(created.guest().getId(), guest("neha@example.com", IdProofType.NATIONAL_ID, "")),
                Map.of("idProofNumber", "Enter the number of the new ID document"));
        assertThat(guests.update(created.guest().getId(), guest("neha@example.com", IdProofType.NATIONAL_ID, "1234 5678 9012"))
                .guest().getIdProofNumber()).isEqualTo("XXXX-XXXX-9012");
    }

    @Test
    void validatesGuestsLikeTheForm() {
        invalid(() -> guests.create(guest("neha@example.com", IdProofType.VOTER_ID, "AB1234567")),
                Map.of("idProofNumber", "Expected 3 letters followed by 7 digits"));
        invalid(() -> guests.create(new GuestInput("N", "not-an-email", "123", "", "", null, "")), Map.of(
                "fullName", "Enter the full name",
                "email", "Enter a valid email address",
                "phone", "Enter a valid phone number, e.g. +91 98450 12345",
                "address", "Enter the address",
                "nationality", "Enter the nationality",
                "idProofType", "Select an ID proof type",
                "idProofNumber", "Enter the ID number"));
        rejected(() -> guests.create(guest("AARAV.MEHTA@example.com", IdProofType.PASSPORT, "N1234567")), 409,
                "This email is already registered to Aarav Mehta");
    }

    @Test
    void derivesStayStatisticsAndProtectsGuestsWithBookings() {
        GuestSummary aarav = guests.get("GST-0001");
        assertThat(aarav.previousBookingCount()).isEqualTo(1);
        assertThat(guests.history("GST-0001").stats().totalReservations()).isEqualTo(2);
        rejected(() -> guests.delete("GST-0001"), 409,
                "Aarav Mehta has 2 reservations and cannot be deleted. Guest records with booking history are kept.");
        assertThat(guests.list(new ListQuery(0, 50, "jose", null), null).content()).allMatch(g -> g.guest().getFullName() != null);
        assertThat(guests.nationalities()).contains("Indian", "Japanese").isSorted();
    }
}
