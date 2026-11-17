package com.hotel.util;

import com.hotel.dto.PageResponse;

import java.util.Comparator;
import java.util.List;
import java.util.function.Function;

/** In-memory pagination helper for list endpoints. */
public final class PageUtils {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 200;

    private PageUtils() {
    }

    public static <T> PageResponse<T> paginate(List<T> items, int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be >= 0");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new IllegalArgumentException("size must be between 1 and " + MAX_SIZE);
        }
        long total = items.size();
        int totalPages = (int) Math.ceil((double) total / size);
        int from = (int) Math.min((long) page * size, total);
        int to = (int) Math.min((long) from + size, total);
        return new PageResponse<>(List.copyOf(items.subList(from, to)), page, size, total, totalPages);
    }

    public static <T> PageResponse<T> paginate(List<T> items, int page, int size, Comparator<T> order) {
        return paginate(items.stream().sorted(order).toList(), page, size);
    }

    public static <T, R> PageResponse<R> map(PageResponse<T> page, Function<T, R> mapper) {
        return new PageResponse<>(page.content().stream().map(mapper).toList(),
                page.page(), page.size(), page.totalElements(), page.totalPages());
    }
}
