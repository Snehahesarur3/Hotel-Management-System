package com.hotel.exception;

import org.springframework.http.HttpStatus;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Base class for errors that carry an HTTP status, a message and optional per-field messages.
 * The field messages are shown next to form inputs (same contract as the frontend mock services).
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final Map<String, String> fieldErrors;

    public ApiException(HttpStatus status, String message, Map<String, String> fieldErrors) {
        super(message);
        this.status = status;
        // Insertion order is kept, so messages are listed in form order.
        this.fieldErrors = fieldErrors == null || fieldErrors.isEmpty() ? null : Collections.unmodifiableMap(new LinkedHashMap<>(fieldErrors));
    }

    public HttpStatus getStatus() {
        return status;
    }

    /** Field name to message, or null when the error is not about specific fields. */
    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
