package com.hotel.dto;

import java.util.List;

/**
 * Paginated list response. {@code page} is zero-based.
 * The frontend mock services return the same shape, so components are agnostic of the data source.
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {
}
