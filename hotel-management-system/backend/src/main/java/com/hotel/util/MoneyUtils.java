package com.hotel.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.stream.Stream;

/** All monetary arithmetic goes through BigDecimal, rounded to 2 decimal places (HALF_UP). */
public final class MoneyUtils {

    public static final int SCALE = 2;
    public static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private MoneyUtils() {
    }

    public static BigDecimal scale(BigDecimal amount) {
        return (amount == null ? BigDecimal.ZERO : amount).setScale(SCALE, ROUNDING);
    }

    public static BigDecimal multiply(BigDecimal amount, long quantity) {
        return scale(amount.multiply(BigDecimal.valueOf(quantity)));
    }

    /** Returns {@code percent}% of {@code amount}, e.g. percentOf(1000, 18) = 180.00. */
    public static BigDecimal percentOf(BigDecimal amount, BigDecimal percent) {
        return scale(amount.multiply(percent).divide(HUNDRED, SCALE + 4, ROUNDING));
    }

    /** Sum of the amounts, two decimals (0.00 for none). */
    public static BigDecimal sum(Collection<BigDecimal> amounts) {
        return scale(amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    public static BigDecimal sum(Stream<BigDecimal> amounts) {
        return scale(amounts.reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    /** amount / units, two decimals HALF_UP (0.00 when there are no units). */
    public static BigDecimal perUnit(BigDecimal amount, long units) {
        return units == 0 ? scale(BigDecimal.ZERO) : amount.divide(BigDecimal.valueOf(units), SCALE, ROUNDING);
    }

    /** part / whole as a percentage with one decimal (0 when whole is 0), like the frontend's percent(). */
    public static double percent(double part, double whole) {
        return whole == 0 ? 0 : Math.round(part / whole * 1000) / 10.0;
    }

    /** part / whole as a percentage with one decimal, for money. */
    public static double percent(BigDecimal part, BigDecimal whole) {
        return percent(part.doubleValue(), whole.doubleValue());
    }

    /** total / count with one decimal (0 for an empty set). */
    public static double average(double total, long count) {
        return count == 0 ? 0 : Math.round(total / count * 10) / 10.0;
    }

    public static boolean isNegative(BigDecimal amount) {
        return amount != null && amount.signum() < 0;
    }
}
