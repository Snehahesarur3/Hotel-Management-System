package com.hotel.payment;

import com.hotel.enums.PaymentMethod;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

/**
 * ============================================================================
 *  MOCK PAYMENT PROCESSING - NOT A REAL PAYMENT GATEWAY
 * ============================================================================
 * Stands in for a payment provider. It never sees, stores or transmits card numbers,
 * UPI IDs or bank details: the front desk only chooses a payment <em>method</em>, and this
 * mock approves every positive amount and returns a test reference:
 * {@code MOCK-TXN-…} / {@code CASH-…} for payments, {@code MOCK-RFD-…} / {@code CASH-RFD-…} for refunds.
 * <p>
 * Same behaviour as the frontend's mock/payments/mockPaymentGateway.ts.
 * Replace this bean with a real {@link PaymentGateway} implementation to go live.
 * ============================================================================
 */
@Component
public class MockPaymentGateway implements PaymentGateway {

    private final SecureRandom random = new SecureRandom();

    @Override
    public PaymentResult charge(PaymentRequest request) {
        if (request.amount() == null || request.amount().signum() <= 0) {
            return PaymentResult.declined("Amount must be greater than zero");
        }
        String prefix = request.method() == PaymentMethod.CASH ? "CASH" : "MOCK-TXN";
        return PaymentResult.approved(prefix + "-" + digits());
    }

    @Override
    public PaymentResult refund(PaymentRequest request) {
        if (request.amount() == null || request.amount().signum() <= 0) {
            return PaymentResult.declined("Refund amount must be greater than zero");
        }
        String prefix = request.method() == PaymentMethod.CASH ? "CASH-RFD" : "MOCK-RFD";
        return PaymentResult.approved(prefix + "-" + digits());
    }

    private String digits() {
        return "%06d".formatted(random.nextInt(1_000_000));
    }
}
