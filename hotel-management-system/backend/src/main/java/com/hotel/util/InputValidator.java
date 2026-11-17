package com.hotel.util;

import com.hotel.exception.ValidationException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * Collects input errors, one message per field: the first rule a field breaks, in the order the rules
 * are written. Rules and messages mirror the frontend zod schemas (frontend/src/schemas), so a form
 * shows the same message whether it talks to the mock services or to this API.
 * <pre>
 * InputValidator v = new InputValidator();
 * v.text("fullName", input.fullName()).min(2, "Enter the full name").max(80, "At most 80 characters");
 * v.number("capacity", input.capacity()).required("Capacity is required").min(1, "At least 1 guest");
 * v.throwIfInvalid();   // 400 "Validation failed" with fieldErrors
 * </pre>
 */
public final class InputValidator {

    public static final Pattern ISO_DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    /** Same pattern as zod's z.email(). */
    public static final Pattern EMAIL = Pattern.compile(
            "^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$");
    /** Letters, then letters, spaces, dots, apostrophes or hyphens. */
    public static final Pattern NAME = Pattern.compile("^\\p{L}[\\p{L} .'-]*$");
    public static final Pattern PHONE = Pattern.compile("^\\+?[0-9][0-9 ()-]{6,19}$");

    private final Map<String, String> errors = new LinkedHashMap<>();

    public boolean has(String field) {
        return errors.containsKey(field);
    }

    public boolean isValid() {
        return errors.isEmpty();
    }

    /** Records an error unless the field already has one. */
    public InputValidator reject(String field, String message) {
        errors.putIfAbsent(field, message);
        return this;
    }

    public InputValidator rejectIf(boolean condition, String field, String message) {
        return condition ? reject(field, message) : this;
    }

    /** Rejects a missing value (null) with {@code message}; returns the value. */
    public <T> T required(String field, T value, String message) {
        if (value == null) {
            reject(field, message);
        }
        return value;
    }

    public TextRules text(String field, String value) {
        return new TextRules(field, value == null ? "" : value);
    }

    public NumberRules number(String field, Number value) {
        return new NumberRules(field, value == null ? null : new BigDecimal(value.toString()));
    }

    /**
     * A yyyy-MM-dd date: {@code missing} when empty, {@code invalid} when malformed or not a real date.
     * Returns the parsed date, or null when it was rejected.
     */
    public LocalDate date(String field, String value, String missing, String invalid) {
        if (value == null || value.isBlank()) {
            reject(field, missing);
            return null;
        }
        if (!ISO_DATE.matcher(value).matches()) {
            reject(field, invalid);
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            reject(field, invalid);
            return null;
        }
    }

    /**
     * An optional yyyy-MM-dd filter parameter: null when absent, a 400 with a field message when malformed.
     */
    public static LocalDate optionalDate(String field, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw ValidationException.of(field, "Use the format yyyy-mm-dd");
        }
    }

    /** Throws a 400 {@link ValidationException} when any field was rejected. */
    public void throwIfInvalid() {
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
    }

    public Map<String, String> errors() {
        return Collections.unmodifiableMap(new LinkedHashMap<>(errors));
    }

    /** Rules for one text field; after the first failure the remaining rules are skipped. */
    public final class TextRules {
        private final String field;
        private final String value;

        private TextRules(String field, String value) {
            this.field = field;
            this.value = value;
        }

        private TextRules check(boolean ok, String message) {
            if (!has(field) && !ok) {
                reject(field, message);
            }
            return this;
        }

        public TextRules min(int length, String message) {
            return check(value.length() >= length, message);
        }

        public TextRules max(int length, String message) {
            return check(value.length() <= length, message);
        }

        public TextRules matches(Pattern pattern, String message) {
            return check(pattern.matcher(value).matches(), message);
        }

        public TextRules satisfies(Predicate<String> rule, String message) {
            return check(rule.test(value), message);
        }
    }

    /** Rules for one numeric field; after the first failure the remaining rules are skipped. */
    public final class NumberRules {
        private final String field;
        private final BigDecimal value;

        private NumberRules(String field, BigDecimal value) {
            this.field = field;
            this.value = value;
        }

        private NumberRules check(boolean ok, String message) {
            if (!has(field) && !ok) {
                reject(field, message);
            }
            return this;
        }

        public NumberRules required(String message) {
            return check(value != null, message);
        }

        public NumberRules min(long minimum, String message) {
            return check(value == null || value.compareTo(BigDecimal.valueOf(minimum)) >= 0, message);
        }

        public NumberRules max(long maximum, String message) {
            return check(value == null || value.compareTo(BigDecimal.valueOf(maximum)) <= 0, message);
        }

        public NumberRules positive(String message) {
            return check(value == null || value.signum() > 0, message);
        }

        public NumberRules wholeNumber(String message) {
            return check(value == null || value.stripTrailingZeros().scale() <= 0, message);
        }

        /** At most two decimal places (money). */
        public NumberRules cents(String message) {
            return check(value == null || value.stripTrailingZeros().scale() <= 2, message);
        }

        /** At most one decimal place (percentages). */
        public NumberRules tenths(String message) {
            return check(value == null || value.stripTrailingZeros().scale() <= 1, message);
        }
    }
}
