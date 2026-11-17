package com.hotel.service;

import com.hotel.dto.BillingDtos.AdjustmentInput;
import com.hotel.dto.BillingDtos.BillLine;
import com.hotel.dto.BillingDtos.Invoice;
import com.hotel.dto.BillingDtos.InvoiceSummary;
import com.hotel.dto.BillingDtos.PaymentInput;
import com.hotel.dto.BillingDtos.RefundInput;
import com.hotel.dto.ListQuery;
import com.hotel.entity.Payment;
import com.hotel.enums.AdjustmentKind;
import com.hotel.enums.BalanceState;
import com.hotel.enums.BillLineKind;
import com.hotel.enums.InvoiceState;
import com.hotel.enums.PaymentMethod;
import com.hotel.enums.PaymentStatus;
import com.hotel.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.Map;

import static com.hotel.support.ApiAssertions.invalid;
import static com.hotel.support.ApiAssertions.rejected;
import static org.assertj.core.api.Assertions.assertThat;

class BillingServiceTest extends IntegrationTest {

    /** In-house in room 309 at ₹5,500 for 3 nights: ₹16,500 of room charges. */
    private static final String IN_HOUSE = "BK-0021";

    @Autowired
    private BillingService billing;

    @Autowired
    private ReservationService reservations;

    private static AdjustmentInput extra(String description, String amount, int gst) {
        return new AdjustmentInput(AdjustmentKind.EXTRA, description, new BigDecimal(amount), gst, null);
    }

    private static AdjustmentInput discount(String amount, String percent) {
        return new AdjustmentInput(AdjustmentKind.DISCOUNT, "Loyalty", amount == null ? null : new BigDecimal(amount),
                null, percent == null ? null : new BigDecimal(percent));
    }

    @Test
    void invoiceStateFollowsTheBooking() {
        assertThat(billing.invoice(IN_HOUSE).summary().state()).isEqualTo(InvoiceState.INTERIM);
        assertThat(billing.invoice(IN_HOUSE).editable()).isTrue();
        assertThat(billing.invoice("BK-0001").summary().state()).isEqualTo(InvoiceState.FINAL);
        assertThat(billing.invoice("BK-0030").summary().state()).isEqualTo(InvoiceState.ESTIMATE);
        assertThat(billing.invoice("BK-0037").summary().state()).isEqualTo(InvoiceState.VOID);
        assertThat(billing.invoice(IN_HOUSE).summary().invoiceNumber()).isEqualTo("INV-0021");
        rejected(() -> billing.invoice("BK-9999"), 404, "Invoice for booking 'BK-9999' was not found");
    }

    @Test
    void extrasAddGstAtTheirOwnRateAndDiscountsReduceTheTaxableRoomValue() {
        BigDecimal before = billing.invoice(IN_HOUSE).bill().total();
        billing.addAdjustment(IN_HOUSE, extra("Laundry", "500", 18));
        Invoice invoice = billing.addAdjustment(IN_HOUSE, discount(null, "10"));

        assertThat(invoice.bill().discount()).isEqualByComparingTo("1650");
        assertThat(invoice.bill().roomGst()).isEqualByComparingTo("1782"); // 12% of 14,850
        assertThat(invoice.bill().lines()).extracting(BillLine::kind)
                .contains(BillLineKind.DISCOUNT, BillLineKind.EXTRA, BillLineKind.EXTRA_GST);
        assertThat(invoice.bill().lines()).filteredOn(l -> l.kind() == BillLineKind.DISCOUNT)
                .extracting(BillLine::description).containsExactly("Loyalty (10% of room charges)");
        // +500 laundry +90 GST -1,650 discount -198 GST saved on the discount
        assertThat(invoice.bill().total()).isEqualByComparingTo(before.add(new BigDecimal("-1258")));
        assertThat(invoice.bill().taxSummary()).extracting("percent").contains(12, 18);

        String adjustmentId = invoice.bill().lines().stream().filter(l -> l.kind() == BillLineKind.EXTRA).findFirst().orElseThrow().adjustmentId();
        assertThat(billing.removeAdjustment(IN_HOUSE, adjustmentId).bill().extraCharges()).isEqualByComparingTo("0");
    }

    @Test
    void discountsCannotExceedRoomChargesAndFinalInvoicesAreLocked() {
        invalid(() -> billing.addAdjustment(IN_HOUSE, discount("20000", null)),
                Map.of("amount", "Discounts can't exceed the room charges (₹16,500.00 left to discount)"));
        invalid(() -> billing.addAdjustment(IN_HOUSE, discount("100", "10")), Map.of("amount", "Enter either an amount or a percentage"));
        invalid(() -> billing.addAdjustment(IN_HOUSE, extra("X", "0", 7)), Map.of(
                "description", "Describe the charge",
                "amount", "The amount must be more than ₹0",
                "gstPercent", "Choose a GST rate"));
        rejected(() -> billing.addAdjustment("BK-0001", extra("Minibar", "300", 18)), 409,
                "INV-0001 is final. Charges can't be changed after check-out.");
    }

    @Test
    void paymentsAreCappedAtTheBalanceDue() {
        BigDecimal due = billing.invoice(IN_HOUSE).summary().balance();
        invalid(() -> billing.recordPayment(IN_HOUSE, new PaymentInput(due.add(BigDecimal.ONE), PaymentMethod.UPI)),
                Map.of("amount", "At most %s (the balance due)".formatted(com.hotel.util.Formats.currency(due))));

        Payment payment = billing.recordPayment(IN_HOUSE, new PaymentInput(new BigDecimal("1000"), PaymentMethod.CREDIT_CARD));
        assertThat(payment.getTransactionReference()).startsWith("MOCK-TXN-");
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(billing.invoice(IN_HOUSE).summary().balance()).isEqualByComparingTo(due.subtract(new BigDecimal("1000")));

        rejected(() -> billing.recordPayment("BK-0037", new PaymentInput(BigDecimal.TEN, PaymentMethod.CASH)), 409,
                "BK-0037 is cancelled; no payment can be taken.");
    }

    @Test
    void creditBalancesAreRefundedInFullAsNegativePayments() {
        // BK-0034 paid a ₹25,000 deposit by bank transfer; once it clears, cancelling the booking leaves a credit.
        billing.updatePaymentStatus("PAY-0024", PaymentStatus.COMPLETED);
        reservations.cancel("BK-0034");
        InvoiceSummary credit = billing.invoices(new ListQuery(0, 50, null, null), BalanceState.CREDIT, null).content().getFirst();
        assertThat(credit.reservationId()).isEqualTo("BK-0034");
        assertThat(credit.state()).isEqualTo(InvoiceState.VOID);
        BigDecimal owed = credit.balance().negate();
        assertThat(owed).isEqualByComparingTo("25000");

        Payment refund = billing.refund(credit.reservationId(), new RefundInput(PaymentMethod.BANK_TRANSFER));
        assertThat(refund.getAmount()).isEqualByComparingTo(owed.negate());
        assertThat(refund.getTransactionReference()).startsWith("MOCK-RFD-");
        assertThat(billing.invoice(credit.reservationId()).summary().balanceState()).isEqualTo(BalanceState.SETTLED);
        rejected(() -> billing.refund(credit.reservationId(), new RefundInput(PaymentMethod.CASH)), 409);
    }

    @Test
    void pendingPaymentsCanBeConfirmedOnce() {
        BigDecimal pendingBefore = billing.summary().pendingTotal();
        assertThat(billing.updatePaymentStatus("PAY-0024", PaymentStatus.COMPLETED).getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(billing.summary().pendingTotal()).isEqualByComparingTo(pendingBefore.subtract(new BigDecimal("25000")));
        rejected(() -> billing.updatePaymentStatus("PAY-0024", PaymentStatus.FAILED), 409,
                "PAY-0024 is completed; only pending payments can be confirmed or failed.");
        assertThat(billing.payments(new ListQuery(0, 5, null, "amount,desc"), PaymentStatus.COMPLETED, null, null, null)
                .content().getFirst().amount()).isEqualByComparingTo("44250");
    }
}
