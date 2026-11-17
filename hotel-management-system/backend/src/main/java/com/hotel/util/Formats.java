package com.hotel.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Human-readable values for API messages, identical to the frontend's utils/format.ts,
 * so an error reads the same whether it comes from the mock services or this API.
 */
public final class Formats {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter SHORT_DATE = DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH);

    private static final Map<String, String> SPECIAL_LABELS = Map.of(
            "BOOKING_COM", "Booking.com",
            "NATIONAL_ID", "National ID",
            "VOTER_ID", "Voter ID",
            "UPI", "UPI",
            "WALK_IN", "Walk-in");

    private Formats() {
    }

    /** ₹1,23,456.50 (Indian digit grouping: thousands, then pairs). */
    public static String currency(BigDecimal amount) {
        BigDecimal value = MoneyUtils.scale(amount);
        String sign = value.signum() < 0 ? "-" : "";
        String[] parts = value.abs().setScale(2, RoundingMode.HALF_UP).toPlainString().split("\\.");
        return sign + "₹" + groupIndian(parts[0]) + "." + parts[1];
    }

    /** 1234567 -> 12,34,567 */
    public static String groupIndian(String digits) {
        if (digits.length() <= 3) {
            return digits;
        }
        String last3 = digits.substring(digits.length() - 3);
        StringBuilder head = new StringBuilder(digits.substring(0, digits.length() - 3));
        for (int i = head.length() - 2; i > 0; i -= 2) {
            head.insert(i, ',');
        }
        return head + "," + last3;
    }

    /** 11 Nov 2026 */
    public static String date(LocalDate date) {
        return date.format(DATE);
    }

    /** 11 Nov */
    public static String shortDate(LocalDate date) {
        return date.format(SHORT_DATE);
    }

    /** CHECKED_IN -> "Checked In", BOOKING_COM -> "Booking.com" */
    public static String label(Enum<?> value) {
        return label(value.name());
    }

    public static String label(String value) {
        String special = SPECIAL_LABELS.get(value);
        if (special != null) {
            return special;
        }
        return Arrays.stream(value.toLowerCase(Locale.ROOT).split("_"))
                .map(w -> w.isEmpty() ? w : Character.toUpperCase(w.charAt(0)) + w.substring(1))
                .collect(Collectors.joining(" "));
    }

    /** "Checked In" -> "checked in", for use mid-sentence. */
    public static String lowerLabel(Enum<?> value) {
        return label(value).toLowerCase(Locale.ROOT);
    }

    /** 1 guest / 3 guests */
    public static String plural(long count, String singular) {
        return count + " " + singular + (count == 1 ? "" : "s");
    }
}
