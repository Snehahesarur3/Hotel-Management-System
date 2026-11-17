package com.sneha.hotel.exception;

/** Thrown when a request is valid in shape but breaks a business rule (e.g. room already booked). */
public class BusinessException extends RuntimeException {
    public BusinessException(String message) {
        super(message);
    }
}
