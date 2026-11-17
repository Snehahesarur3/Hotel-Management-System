package com.hotel.dto;

/**
 * Paging, search and sort parameters accepted by every list endpoint:
 * {@code ?page=0&size=20&search=suite&sort=floor,desc}. Module filters are separate request parameters.
 *
 * @param page   zero-based page (default 0)
 * @param size   page size (default 20, at most 200)
 * @param search case- and accent-insensitive words, all of which must match
 * @param sort   {@code field,asc} or {@code field,desc}
 */
public record ListQuery(Integer page, Integer size, String search, String sort) {

    public static ListQuery all() {
        return new ListQuery(null, null, null, null);
    }
}
