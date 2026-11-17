package com.hotel.util;

import java.text.Collator;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Search and ordering of text, with the same semantics as the frontend (mock/collection.ts):
 * case- and accent-insensitive search on every word, and "natural" ordering where
 * digit runs compare as numbers ("Room 9" before "Room 10").
 */
public final class TextMatching {

    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern CHUNKS = Pattern.compile("\\d+|\\D+");
    private static final Collator COLLATOR = Collator.getInstance(Locale.ENGLISH);

    static {
        COLLATOR.setStrength(Collator.PRIMARY); // ignore case and accents, like Intl.Collator sensitivity "base"
    }

    /** Natural, case- and accent-insensitive order. */
    public static final Comparator<String> NATURAL = TextMatching::compareNatural;

    private TextMatching() {
    }

    /** Lower-cases and strips accents so "jose" matches "José". */
    public static String normalize(String value) {
        return MARKS.matcher(Normalizer.normalize(value, Normalizer.Form.NFD)).replaceAll("")
                .toLowerCase(Locale.ROOT).trim();
    }

    /** Every word of {@code search} appears somewhere in the fields (blank search matches everything). */
    public static boolean matches(Collection<?> fields, String search) {
        if (search == null || search.isBlank()) {
            return true;
        }
        String haystack = normalize(fields.stream().filter(Objects::nonNull).map(String::valueOf)
                .collect(Collectors.joining(" ")));
        return Arrays.stream(normalize(search).split("\\s+")).allMatch(haystack::contains);
    }

    public static int compareNatural(String a, String b) {
        Matcher left = CHUNKS.matcher(a);
        Matcher right = CHUNKS.matcher(b);
        while (left.find() && right.find()) {
            String x = left.group();
            String y = right.group();
            int result = Character.isDigit(x.charAt(0)) && Character.isDigit(y.charAt(0))
                    ? compareDigits(x, y)
                    : COLLATOR.compare(x, y);
            if (result != 0) {
                return result;
            }
        }
        // The shorter string (fewer chunks) sorts first.
        return Integer.compare(chunkCount(a), chunkCount(b));
    }

    private static int compareDigits(String x, String y) {
        String a = x.replaceFirst("^0+(?=.)", "");
        String b = y.replaceFirst("^0+(?=.)", "");
        return a.length() != b.length() ? Integer.compare(a.length(), b.length()) : a.compareTo(b);
    }

    private static int chunkCount(String value) {
        return (int) CHUNKS.matcher(value).results().count();
    }
}
