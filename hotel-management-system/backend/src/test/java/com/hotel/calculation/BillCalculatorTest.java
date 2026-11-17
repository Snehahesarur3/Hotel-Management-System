package com.hotel.calculation;

import com.hotel.dto.BillingDtos.StayBill;
import com.hotel.entity.BillAdjustment;
import com.hotel.entity.Reservation;
import com.hotel.enums.AdjustmentKind;
import com.hotel.enums.BillLineKind;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.PaymentMethod;
import com.hotel.payment.MockPaymentGateway;
import com.hotel.payment.PaymentGateway.PaymentRequest;
import com.hotel.payment.PaymentGateway.PaymentResult;
import com.hotel.seed.DateTokens;
import com.hotel.store.HotelData;
import com.hotel.support.SeedFixture;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** Folio rules, pricing, date tokens and the mock gateway, without Spring. */
class BillCalculatorTest {

    private static final LocalDate TODAY = SeedFixture.TODAY;

    private static BillAdjustment adjustment(String id, AdjustmentKind kind, String amount, Integer gst, String percent) {
        return BillAdjustment.builder().id(id).reservationId("BK-0021").kind(kind).description(kind == AdjustmentKind.EXTRA ? "Spa" : "Goodwill")
                .amount(amount == null ? null : new BigDecimal(amount)).gstPercent(gst)
                .percent(percent == null ? null : new BigDecimal(percent)).createdAt(LocalDateTime.of(2026, 11, 11, 9, 0)).build();
    }

    @Test
    void discountsAreCappedAtTheRoomCharges() {
        // BK-0021: 3 nights at ₹5,500 = ₹16,500 of room charges.
        HotelData db = SeedFixture.builder().with(b -> {
            b.adjustments.add(adjustment("ADJ-0001", AdjustmentKind.DISCOUNT, "10000", null, null));
            b.adjustments.add(adjustment("ADJ-0002", AdjustmentKind.DISCOUNT, null, null, "50"));
        }).build();
        StayBill bill = BillCalculator.calculateStayBill(db, db.reservation("BK-0021"));
        assertThat(bill.discount()).isEqualByComparingTo("16500");
        assertThat(bill.roomGst()).isEqualByComparingTo("0");
        assertThat(bill.lines()).filteredOn(l -> l.kind() == BillLineKind.DISCOUNT).extracting("amount")
                .usingElementComparator((a, b) -> ((BigDecimal) a).compareTo((BigDecimal) b))
                .containsExactly(new BigDecimal("-10000"), new BigDecimal("-6500"));
    }

    @Test
    void extrasAreTaxedAtTheirOwnRatesAndGroupedPerRate() {
        HotelData db = SeedFixture.builder().with(b -> {
            b.adjustments.add(adjustment("ADJ-0001", AdjustmentKind.EXTRA, "1000", 18, null));
            b.adjustments.add(adjustment("ADJ-0002", AdjustmentKind.EXTRA, "500", 18, null));
            b.adjustments.add(adjustment("ADJ-0003", AdjustmentKind.EXTRA, "200", 0, null));
        }).build();
        StayBill bill = BillCalculator.calculateStayBill(db, db.reservation("BK-0021"));
        assertThat(bill.extraCharges()).isEqualByComparingTo("1700");
        assertThat(bill.extraGst()).isEqualByComparingTo("270");
        assertThat(bill.lines()).filteredOn(l -> l.kind() == BillLineKind.EXTRA_GST).extracting("description")
                .containsExactly("GST on extras (18%)");
        // One row per rate, lowest first (the stay's restaurant orders add a 5% food row).
        assertThat(bill.taxSummary()).extracting("percent", Integer.class).contains(0, 12, 18).doesNotHaveDuplicates().isSorted();
    }

    @Test
    void cancelledStaysCarryNoChargesAndDayUseIsOneNight() {
        HotelData db = SeedFixture.load();
        StayBill cancelled = BillCalculator.calculateStayBill(db, db.reservation("BK-0037"));
        assertThat(cancelled.total()).isEqualByComparingTo("0");
        assertThat(cancelled.lines()).isEmpty();

        Reservation stay = db.reservation("BK-0021");
        StayBill dayUse = BillCalculator.calculateStayBill(db, stay, stay.getCheckIn());
        assertThat(dayUse.nights()).isEqualTo(1);
        assertThat(dayUse.lines().getFirst().description()).isEqualTo("Room 309 · 1 night × ₹5,500.00");
    }

    @Test
    void roomGstFollowsTheSlabForTheNightlyRate() {
        HotelData db = SeedFixture.load();
        var slabs = db.settings().taxes().roomGstSlabs();
        assertThat(Pricing.roomGstPercent(new BigDecimal("7500"), slabs)).isEqualTo(12);
        assertThat(Pricing.roomGstPercent(new BigDecimal("7500.01"), slabs)).isEqualTo(18);
        var quote = Pricing.quoteStay(new BigDecimal("8000"), TODAY, TODAY.plusDays(2), slabs);
        assertThat(quote.roomCharges()).isEqualByComparingTo("16000");
        assertThat(quote.gstAmount()).isEqualByComparingTo("2880");
        assertThat(quote.total()).isEqualByComparingTo("18880");
        assertThat(db.reservation("BK-0021").getStatus()).isEqualTo(BookingStatus.CHECKED_IN);
    }

    @Test
    void resolvesSeedDateTokens() {
        assertThat(DateTokens.resolve("T+3", TODAY)).isEqualTo("2026-11-14");
        assertThat(DateTokens.resolve("T-2@14:30", TODAY)).isEqualTo("2026-11-09T14:30:00");
        assertThat(DateTokens.resolve("Tomorrow", TODAY)).isNull();
    }

    @Test
    void mockGatewayApprovesPositiveAmountsWithTestReferences() {
        MockPaymentGateway gateway = new MockPaymentGateway();
        PaymentResult card = gateway.charge(new PaymentRequest(new BigDecimal("100"), PaymentMethod.CREDIT_CARD, "BK-0021"));
        assertThat(card.approved()).isTrue();
        assertThat(card.transactionReference()).matches("MOCK-TXN-\\d{6}");
        assertThat(gateway.refund(new PaymentRequest(new BigDecimal("100"), PaymentMethod.CASH, "BK-0021")).transactionReference())
                .matches("CASH-RFD-\\d{6}");
        assertThat(gateway.charge(new PaymentRequest(BigDecimal.ZERO, PaymentMethod.UPI, "BK-0021")).approved()).isFalse();
    }
}
