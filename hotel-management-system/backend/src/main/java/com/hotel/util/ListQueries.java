package com.hotel.util;

import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Search, filter, sort and paginate a list, with the same semantics as the frontend's applyListQuery:
 * <ul>
 *   <li>search: every word must appear in one of the searchable fields (case and accents ignored);</li>
 *   <li>sort: only registered fields; empty values sort last in both directions; ties use the default order;</li>
 *   <li>paging: zero-based pages of 1–200 items.</li>
 * </ul>
 */
public final class ListQueries {

    private ListQueries() {
    }

    public static <T> PageResponse<T> apply(List<T> items, ListQuery query, Spec<T> spec) {
        ListQuery q = query == null ? ListQuery.all() : query;
        List<T> filtered = items.stream()
                .filter(spec.filter)
                .filter(item -> spec.searchFields == null || TextMatching.matches(spec.searchFields.apply(item), q.search()))
                .toList();

        Comparator<T> order = sortOrder(q.sort(), spec);
        List<T> sorted = order == null ? filtered : filtered.stream().sorted(order).toList();
        int page = q.page() == null ? 0 : q.page();
        int size = q.size() == null ? PageUtils.DEFAULT_SIZE : q.size();
        return PageUtils.paginate(sorted, page, size);
    }

    private static <T> Comparator<T> sortOrder(String sort, Spec<T> spec) {
        if (sort == null || sort.isBlank()) {
            return spec.defaultOrder;
        }
        String[] parts = sort.split(",", 2);
        String field = parts[0].trim();
        boolean descending = parts.length > 1 && parts[1].trim().equalsIgnoreCase("desc");
        Function<T, ?> accessor = spec.sortFields.get(field);
        if (accessor == null) {
            throw new IllegalArgumentException("Cannot sort by '%s'. Sortable fields: %s".formatted(field, spec.sortFields.keySet()));
        }
        Comparator<T> primary = (a, b) -> {
            Object x = accessor.apply(a);
            Object y = accessor.apply(b);
            int result = compareValues(x, y);
            // Empty values stay last regardless of direction.
            return descending && x != null && y != null ? -result : result;
        };
        return spec.defaultOrder == null ? primary : primary.thenComparing(spec.defaultOrder);
    }

    /** Nulls last; numbers numerically; text naturally; anything else by its natural order. */
    @SuppressWarnings({"unchecked", "rawtypes"})
    public static int compareValues(Object a, Object b) {
        if (a == b) {
            return 0;
        }
        if (a == null) {
            return 1;
        }
        if (b == null) {
            return -1;
        }
        if (a instanceof Number x && b instanceof Number y) {
            return new BigDecimal(x.toString()).compareTo(new BigDecimal(y.toString()));
        }
        if (a instanceof String x && b instanceof String y) {
            return TextMatching.compareNatural(x, y);
        }
        if (a instanceof Comparable x && a.getClass().isInstance(b)) {
            return x.compareTo(b);
        }
        return TextMatching.compareNatural(String.valueOf(a), String.valueOf(b));
    }

    /** What a module allows: searchable fields, filters, sortable fields and its default order. */
    public static final class Spec<T> {
        private Function<T, Collection<?>> searchFields;
        private Predicate<T> filter = item -> true;
        private final Map<String, Function<T, ?>> sortFields = new LinkedHashMap<>();
        private Comparator<T> defaultOrder;

        public static <T> Spec<T> of() {
            return new Spec<>();
        }

        public Spec<T> search(Function<T, Collection<?>> fields) {
            this.searchFields = fields;
            return this;
        }

        /** Adds a filter; several filters must all pass. */
        public Spec<T> filter(Predicate<T> predicate) {
            this.filter = this.filter.and(predicate);
            return this;
        }

        /** Adds a filter that only applies when the parameter is present. */
        public <V> Spec<T> filterIf(V parameter, Function<V, Predicate<T>> predicate) {
            return parameter == null || (parameter instanceof String s && s.isBlank()) ? this : filter(predicate.apply(parameter));
        }

        public Spec<T> sortBy(String field, Function<T, ?> accessor) {
            sortFields.put(field, accessor);
            return this;
        }

        public Spec<T> defaultOrder(Comparator<T> order) {
            this.defaultOrder = order;
            return this;
        }
    }
}
