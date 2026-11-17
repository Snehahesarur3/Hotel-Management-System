package com.hotel.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.hotel.entity.Payment;
import com.hotel.enums.AdjustmentKind;
import com.hotel.enums.BalanceState;
import com.hotel.enums.BillLineKind;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.InvoiceState;
import com.hotel.enums.OrderStatus;
import com.hotel.enums.PaymentMethod;
import com.hotel.enums.PaymentStatus;
import com.hotel.enums.RoomType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** /api/billing and /api/payments (frontend types/billing.ts). */
public final class BillingDtos {

    private BillingDtos() {
    }

    /**
     * @param amount       negative for discounts
     * @param adjustmentId set on lines that come from an adjustment (removable while the folio is open)
     */
    public record BillLine(BillLineKind kind, String description, BigDecimal amount, String adjustmentId) {
    }

    public record BillOrder(String id, LocalDateTime orderedAt, OrderStatus status, int itemCount, BigDecimal amount) {
    }

    /** Taxable value and GST per rate (shown on invoices split equally into CGST and SGST). */
    public record TaxSummaryRow(int percent, BigDecimal taxable, BigDecimal tax) {
    }

    /**
     * The folio of a stay: every charge, discount, tax and payment.
     *
     * @param checkOut       departure the bill is calculated for (today for an early or late check-out)
     * @param bookedCheckOut booked departure, for comparison
     * @param discount       total discount on room charges (never more than the room charges)
     * @param paid           completed payments, net of refunds
     * @param balance        total - paid; negative means the guest is in credit
     * @param orders         restaurant orders charged to the stay (cancelled orders excluded)
     */
    public record StayBill(
            String reservationId,
            String guestName,
            String roomNumber,
            BookingStatus status,
            LocalDate checkIn,
            LocalDate checkOut,
            LocalDate bookedCheckOut,
            int nights,
            BigDecimal roomRate,
            List<BillLine> lines,
            BigDecimal roomCharges,
            BigDecimal discount,
            int roomGstPercent,
            BigDecimal roomGst,
            BigDecimal foodCharges,
            int foodGstPercent,
            BigDecimal foodGst,
            BigDecimal extraCharges,
            BigDecimal extraGst,
            List<TaxSummaryRow> taxSummary,
            BigDecimal total,
            BigDecimal paid,
            BigDecimal balance,
            List<Payment> payments,
            List<BillOrder> orders) {
    }

    public record InvoiceSummary(
            String reservationId,
            String invoiceNumber,
            String guestId,
            String guestName,
            String roomNumber,
            RoomType roomType,
            LocalDate checkIn,
            LocalDate checkOut,
            BookingStatus bookingStatus,
            InvoiceState state,
            BigDecimal total,
            BigDecimal paid,
            BigDecimal balance,
            BalanceState balanceState) {
    }

    public record HotelInfo(String name, String address, String phone, String email, String gstin) {
    }

    public record GuestInfo(String id, String fullName, String email, String phone, String address) {
    }

    /**
     * GET /api/billing/invoices/{reservationId}
     *
     * @param issuedOn check-out date for final invoices, otherwise today
     * @param editable charges and discounts can still change (estimate or interim)
     */
    public record Invoice(
            @JsonUnwrapped InvoiceSummary summary,
            LocalDate issuedOn,
            HotelInfo hotel,
            GuestInfo guest,
            StayBill bill,
            boolean editable) {
    }

    /** GET /api/billing/summary */
    public record BillingSummary(
            BigDecimal outstandingTotal,
            int outstandingCount,
            BigDecimal creditTotal,
            int creditCount,
            BigDecimal collectedThisMonth,
            BigDecimal pendingTotal,
            int pendingCount) {
    }

    /**
     * Body of POST /api/billing/invoices/{reservationId}/adjustments.
     * EXTRA: description, amount and gstPercent (0, 5, 12 or 18).
     * DISCOUNT: description and either amount (fixed) or percent (of room charges).
     */
    public record AdjustmentInput(
            AdjustmentKind kind,
            String description,
            BigDecimal amount,
            Integer gstPercent,
            BigDecimal percent) {
    }

    /** Body of POST /api/billing/invoices/{reservationId}/payments */
    public record PaymentInput(BigDecimal amount, PaymentMethod method) {
    }

    /** Body of POST /api/billing/invoices/{reservationId}/refund: refunds the whole credit balance. */
    public record RefundInput(PaymentMethod method) {
    }

    /** Body of PATCH /api/payments/{id}/status */
    public record PaymentStatusUpdate(PaymentStatus status) {
    }

    /** Payment history row (GET /api/payments). Refunds are negative amounts. */
    public record PaymentRecord(
            String id,
            String reservationId,
            String invoiceNumber,
            String guestName,
            String roomNumber,
            BigDecimal amount,
            PaymentMethod method,
            PaymentStatus status,
            LocalDateTime paymentDate,
            String transactionReference) {
    }

    /** INV-0013 belongs to booking BK-0013. */
    public static String invoiceNumberFor(String reservationId) {
        return reservationId.replaceFirst("^BK-", "INV-");
    }
}
