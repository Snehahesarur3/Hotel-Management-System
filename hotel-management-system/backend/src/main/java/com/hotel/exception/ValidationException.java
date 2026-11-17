package com.hotel.exception;

import org.springframework.http.HttpStatus;

import java.util.Map;

/** Input that breaks a validation rule. Mapped to HTTP 400 with one message per invalid field. */
public class ValidationException extends ApiException {

    public static final String MESSAGE = "Validation failed";

    public ValidationException(Map<String, String> fieldErrors) {
        super(HttpStatus.BAD_REQUEST, MESSAGE, fieldErrors);
    }

    public ValidationException(String message, Map<String, String> fieldErrors) {
        super(HttpStatus.BAD_REQUEST, message, fieldErrors);
    }

    public static ValidationException of(String field, String message) {
        return new ValidationException(Map.of(field, message));
    }
}
