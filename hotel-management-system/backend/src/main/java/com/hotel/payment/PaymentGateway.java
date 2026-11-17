package com.hotel.payment;

import com.hotel.enums.PaymentMethod;

import java.math.BigDecimal;

/**
 * Contract for a payment provider (card acquirer, UPI PSP, bank).
 * <p>
 * The only implementation today is {@link MockPaymentGateway}. A real provider is integrated by adding
 * another implementation of this interface (and the provider's SDK) on the backend; card numbers,
 * UPI IDs and bank details must be handled by the provider's hosted flow, never by this API.
 */
public interface PaymentGateway {

    /** Takes money from the guest. */
    PaymentResult charge(PaymentRequest request);

    /** Returns money to the guest (the amount is positive here; it is stored as a negative payment). */
    PaymentResult refund(PaymentRequest request);

    /** @param reference what is being paid, e.g. the reservation id (the provider's order reference) */
    record PaymentRequest(BigDecimal amount, PaymentMethod method, String reference) {
    }

    /** Approved with a transaction reference, or declined with a reason. */
    record PaymentResult(boolean approved, String transactionReference, String declineReason) {

        public static PaymentResult approved(String transactionReference) {
            return new PaymentResult(true, transactionReference, null);
        }

        public static PaymentResult declined(String reason) {
            return new PaymentResult(false, null, reason);
        }
    }
}
