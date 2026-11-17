package com.hotel.enums;

/** Application roles used for authorization (mapped to Spring Security ROLE_ authorities). */
public enum UserRole {
    ADMIN,
    MANAGER,
    RECEPTIONIST,
    HOUSEKEEPING,
    RESTAURANT
}
