package com.hotel.exception;

import org.springframework.http.HttpStatus;

/** The payment gateway refused a charge or refund. Mapped to HTTP 402. */
public class PaymentDeclinedException extends ApiException {

    public PaymentDeclinedException(String message) {
        super(HttpStatus.PAYMENT_REQUIRED, message, null);
    }
}
