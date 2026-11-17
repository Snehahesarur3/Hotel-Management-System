package com.hotel.service;

import com.hotel.dto.FrontDeskDtos.CheckInInput;
import com.hotel.dto.FrontDeskDtos.CheckInPreview;
import com.hotel.dto.FrontDeskDtos.CheckOutInput;
import com.hotel.dto.FrontDeskDtos.CheckOutResult;
import com.hotel.dto.FrontDeskDtos.FrontDeskOverview;
import com.hotel.dto.ListQuery;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.HousekeepingTaskType;
import com.hotel.enums.PaymentMethod;
import com.hotel.enums.RoomStatus;
import com.hotel.exception.ApiException;
import com.hotel.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;

import static com.hotel.support.ApiAssertions.invalid;
import static com.hotel.support.ApiAssertions.rejected;
import static org.assertj.core.api.Assertions.assertThat;

class FrontDeskServiceTest extends IntegrationTest {

    @Autowired
    private FrontDeskService frontDesk;

    @Autowired
    private RoomService rooms;

    @Autowired
    private ReservationService reservations;

    @Autowired
    private HousekeepingService housekeeping;

    @Test
    void listsArrivalsInHouseGuestsAndDepartures() {
        FrontDeskOverview overview = frontDesk.overview();
        assertThat(overview.date()).isEqualTo(TODAY);
        assertThat(overview.arrivals()).extracting("id").containsExactlyInAnyOrder("BK-0027", "BK-0028", "BK-0029");
        assertThat(overview.inHouse()).hasSize(14);
        assertThat(overview.departures()).extracting("id").containsExactlyInAnyOrder("BK-0015", "BK-0016", "BK-0020");
    }

    @Test
    void checksTheIdBeforeHandingOverTheRoom() {
        CheckInPreview preview = frontDesk.checkInPreview("BK-0027");
        assertThat(preview.rooms().getFirst().room().getId()).isEqualTo("RM-104");
        assertThat(preview.rooms().getFirst().ready()).isTrue();
        assertThat(preview.lateArrival()).isFalse();

        ApiException wrongId = rejected(() -> frontDesk.checkIn("BK-0027", new CheckInInput("RM-104", "1234")), 400, "Identity check failed");
        assertThat(wrongId.getFieldErrors()).containsEntry("idLast4", "Doesn't match the Driving License on file. Check the document again.");
        invalid(() -> frontDesk.checkIn("BK-0027", new CheckInInput("", "56")), Map.of(
                "roomId", "Choose the room to assign",
                "idLast4", "Enter the last 4 letters or digits from the ID document"));

        var stay = frontDesk.checkIn("BK-0027", new CheckInInput("RM-104", " 56-07 "));
        assertThat(stay.status()).isEqualTo(BookingStatus.CHECKED_IN);
        assertThat(rooms.get("RM-104").getStatus()).isEqualTo(RoomStatus.OCCUPIED);
    }

    @Test
    void movingAGuestKeepsTheRateAndFreesTheBookedRoom() {
        var stay = frontDesk.checkIn("BK-0027", new CheckInInput("RM-101", "5607"));
        assertThat(stay.roomId()).isEqualTo("RM-101");
        assertThat(reservations.get("BK-0027").roomRate()).isEqualByComparingTo("3500");
        assertThat(rooms.get("RM-104").getStatus()).isEqualTo(RoomStatus.AVAILABLE);
        assertThat(rooms.get("RM-101").getStatus()).isEqualTo(RoomStatus.OCCUPIED);

        rejected(() -> frontDesk.checkIn("BK-0028", new CheckInInput("RM-107", "4377")), 409, "Room 107 can't be assigned: being cleaned");
        rejected(() -> frontDesk.checkIn("BK-0030", new CheckInInput("RM-106", "5878")), 409,
                "BK-0030 arrives on 14 Nov 2026. Check-in opens on the arrival date.");
    }

    @Test
    void checkOutSettlesTheBalanceAndSchedulesTheCleaning() {
        // BK-0013 (room 102) leaves a day early with room and restaurant charges still to pay.
        var due = frontDesk.checkOutPreview("BK-0013").balance();
        assertThat(due).isPositive();
        ApiException unpaid = rejected(() -> frontDesk.checkOut("BK-0013", new CheckOutInput(null)), 409);
        assertThat(unpaid.getMessage()).startsWith("Collect the outstanding ₹");
        assertThat(unpaid.getFieldErrors()).containsEntry("paymentMethod", "Choose how the guest is paying");

        CheckOutResult result = frontDesk.checkOut("BK-0013", new CheckOutInput(PaymentMethod.CASH));
        assertThat(result.reservation().status()).isEqualTo(BookingStatus.CHECKED_OUT);
        assertThat(result.payment().getAmount()).isEqualByComparingTo(due);
        assertThat(result.payment().getTransactionReference()).startsWith("CASH-");
        assertThat(result.bill().balance()).isEqualByComparingTo("0");
        assertThat(rooms.get("RM-102").getStatus()).isEqualTo(RoomStatus.CLEANING);

        var task = housekeeping.list(new ListQuery(0, 200, result.housekeepingTaskId(), null), null, null, null, null, null, null)
                .content().getFirst();
        assertThat(task.summary().taskType()).isEqualTo(HousekeepingTaskType.CHECKOUT_CLEAN);
        assertThat(task.summary().status()).isEqualTo(HousekeepingStatus.PENDING);
        assertThat(task.summary().scheduledDate()).isEqualTo(TODAY);

        rejected(() -> frontDesk.checkOut("BK-0013", new CheckOutInput(PaymentMethod.CASH)), 409,
                "BK-0013 is checked out; only checked-in stays can be checked out");
    }

    @Test
    void aPrepaidGuestChecksOutWithoutAPayment() {
        // BK-0015 (room 108) is due out today and has already paid in full.
        CheckOutResult result = frontDesk.checkOut("BK-0015", new CheckOutInput(null));
        assertThat(result.payment()).isNull();
        assertThat(result.bill().balance()).isEqualByComparingTo("0");
        assertThat(rooms.get("RM-108").getStatus()).isEqualTo(RoomStatus.CLEANING);
    }

    @Test
    void earlyCheckOutBillsTheNightsUsed() {
        // BK-0023 arrived yesterday for 5 nights; leaving today bills 1 night.
        var bill = frontDesk.checkOutPreview("BK-0023");
        assertThat(bill.nights()).isEqualTo(1);
        assertThat(bill.checkOut()).isEqualTo(TODAY);
        assertThat(bill.bookedCheckOut()).isEqualTo(TODAY.plusDays(4));
    }
}
