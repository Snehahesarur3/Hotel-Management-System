package com.hotel.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

/**
 * Thrown when a request is well-formed but violates a business rule
 * (double booking, invalid status transition, insufficient stock...). Mapped to HTTP 409.
 */
public class BusinessRuleException extends ApiException {

    public BusinessRuleException(String message) {
        super(HttpStatus.CONFLICT, message, null);
    }

    /** The message is also attached to {@code field}, so the form can show it next to the input. */
    public BusinessRuleException(String message, String field) {
        super(HttpStatus.CONFLICT, message, Map.of(field, message));
    }

    public BusinessRuleException(String message, Map<String, String> fieldErrors) {
        super(HttpStatus.CONFLICT, message, fieldErrors);
    }
}
