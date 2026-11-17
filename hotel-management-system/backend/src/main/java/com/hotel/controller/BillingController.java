package com.hotel.controller;

import com.hotel.dto.BillingDtos.AdjustmentInput;
import com.hotel.dto.BillingDtos.BillingSummary;
import com.hotel.dto.BillingDtos.Invoice;
import com.hotel.dto.BillingDtos.InvoiceSummary;
import com.hotel.dto.BillingDtos.PaymentInput;
import com.hotel.dto.BillingDtos.PaymentRecord;
import com.hotel.dto.BillingDtos.PaymentStatusUpdate;
import com.hotel.dto.BillingDtos.RefundInput;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.entity.Payment;
import com.hotel.enums.BalanceState;
import com.hotel.enums.InvoiceState;
import com.hotel.enums.PaymentMethod;
import com.hotel.enums.PaymentStatus;
import com.hotel.service.BillingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Invoices and payments. Payments use the MOCK payment gateway (see com.hotel.payment). */
@Tag(name = "Billing & payments", description = "Invoices, folio adjustments, payments and refunds (mock gateway)")
@RestController
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billing;

    @Operation(summary = "Outstanding balances, credits, this month's collections, pending payments")
    @GetMapping("/api/billing/summary")
    public BillingSummary summary() {
        return billing.summary();
    }

    @Operation(summary = "Invoices (sort: invoiceNumber, guestName, checkIn, checkOut, total, balance)")
    @GetMapping("/api/billing/invoices")
    public PageResponse<InvoiceSummary> invoices(ListQuery query,
                                                 @RequestParam(required = false) BalanceState balance,
                                                 @RequestParam(required = false) InvoiceState state) {
        return billing.invoices(query, balance, state);
    }

    @GetMapping("/api/billing/invoices/{reservationId}")
    public Invoice invoice(@PathVariable String reservationId) {
        return billing.invoice(reservationId);
    }

    @Operation(summary = "Post an extra charge or a discount (discounts: Admin and Manager only)")
    @PreAuthorize("#input.kind() != T(com.hotel.enums.AdjustmentKind).DISCOUNT or hasAnyRole('ADMIN', 'MANAGER')")
    @PostMapping("/api/billing/invoices/{reservationId}/adjustments")
    public Invoice addAdjustment(@PathVariable String reservationId, @RequestBody AdjustmentInput input) {
        return billing.addAdjustment(reservationId, input);
    }

    @DeleteMapping("/api/billing/invoices/{reservationId}/adjustments/{adjustmentId}")
    public Invoice removeAdjustment(@PathVariable String reservationId, @PathVariable String adjustmentId) {
        return billing.removeAdjustment(reservationId, adjustmentId);
    }

    @Operation(summary = "Record a payment (up to the balance due), processed by the mock gateway")
    @PostMapping("/api/billing/invoices/{reservationId}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public Payment recordPayment(@PathVariable String reservationId, @RequestBody PaymentInput input) {
        return billing.recordPayment(reservationId, input);
    }

    @Operation(summary = "Refund the whole credit balance")
    @PostMapping("/api/billing/invoices/{reservationId}/refund")
    @ResponseStatus(HttpStatus.CREATED)
    public Payment refund(@PathVariable String reservationId, @RequestBody RefundInput input) {
        return billing.refund(reservationId, input);
    }

    @Operation(summary = "Payment history; from/to filter by payment date (sort: paymentDate, amount, guestName, method, status)")
    @GetMapping("/api/payments")
    public PageResponse<PaymentRecord> payments(ListQuery query,
                                                @RequestParam(required = false) PaymentStatus status,
                                                @RequestParam(required = false) PaymentMethod method,
                                                @RequestParam(required = false) String from,
                                                @RequestParam(required = false) String to) {
        return billing.payments(query, status, method, from, to);
    }

    @Operation(summary = "Confirm or fail a pending payment")
    @PatchMapping("/api/payments/{id}/status")
    public Payment updatePaymentStatus(@PathVariable String id, @RequestBody PaymentStatusUpdate body) {
        return billing.updatePaymentStatus(id, body.status());
    }
}
