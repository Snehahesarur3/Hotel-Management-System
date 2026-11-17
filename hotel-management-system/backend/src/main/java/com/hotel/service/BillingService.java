package com.hotel.service;

import com.hotel.dto.BillingDtos.AdjustmentInput;
import com.hotel.dto.BillingDtos.BillingSummary;
import com.hotel.dto.BillingDtos.Invoice;
import com.hotel.dto.BillingDtos.InvoiceSummary;
import com.hotel.dto.BillingDtos.PaymentInput;
import com.hotel.dto.BillingDtos.PaymentRecord;
import com.hotel.dto.BillingDtos.RefundInput;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.entity.Payment;
import com.hotel.enums.BalanceState;
import com.hotel.enums.InvoiceState;
import com.hotel.enums.PaymentMethod;
import com.hotel.enums.PaymentStatus;

/** /api/billing and /api/payments: invoices, folio adjustments, payments and refunds. */
public interface BillingService {

    BillingSummary summary();

    PageResponse<InvoiceSummary> invoices(ListQuery query, BalanceState balance, InvoiceState state);

    Invoice invoice(String reservationId);

    /** Extra charge or discount; only while the folio is open (estimate or interim). */
    Invoice addAdjustment(String reservationId, AdjustmentInput input);

    Invoice removeAdjustment(String reservationId, String adjustmentId);

    /** At most the balance due; processed by the payment gateway. */
    Payment recordPayment(String reservationId, PaymentInput input);

    /** Refunds the whole credit balance (stored as a negative payment). */
    Payment refund(String reservationId, RefundInput input);

    /** {@code from}/{@code to} (yyyy-MM-dd) filter by payment date. */
    PageResponse<PaymentRecord> payments(ListQuery query, PaymentStatus status, PaymentMethod method, String from, String to);

    /** Confirms or fails a pending payment. */
    Payment updatePaymentStatus(String paymentId, PaymentStatus status);
}
