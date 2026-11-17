package com.hotel.exception;

import org.springframework.http.HttpStatus;

/** Thrown when a requested entity does not exist. Mapped to HTTP 404. */
public class ResourceNotFoundException extends ApiException {

    public ResourceNotFoundException(String resource, String id) {
        super(HttpStatus.NOT_FOUND, "%s with id '%s' was not found".formatted(resource, id), null);
    }

    private ResourceNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message, null);
    }

    /** For messages that don't fit "X with id 'y' was not found". */
    public static ResourceNotFoundException withMessage(String message) {
        return new ResourceNotFoundException(message);
    }
}
