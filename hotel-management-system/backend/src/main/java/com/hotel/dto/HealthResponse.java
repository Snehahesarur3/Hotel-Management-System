package com.hotel.dto;

import java.time.Instant;

public record HealthResponse(String status, String dataMode, Instant timestamp) {
}
