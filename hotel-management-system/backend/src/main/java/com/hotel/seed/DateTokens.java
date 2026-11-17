package com.hotel.seed;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Resolves the seed's relative dates against today (same rules as the frontend's resolveDateToken):
 * {@code "T+3"} becomes today + 3 days (yyyy-MM-dd) and {@code "T-2@14:30"} becomes
 * today - 2 days at 14:30 (yyyy-MM-ddTHH:mm:ss).
 */
public final class DateTokens {

    private static final Pattern TOKEN = Pattern.compile("^T([+-]\\d+)(?:@(\\d{2}):(\\d{2}))?$");

    private DateTokens() {
    }

    /** The resolved value, or null when {@code value} is not a date token. */
    public static String resolve(String value, LocalDate today) {
        Matcher match = TOKEN.matcher(value);
        if (!match.matches()) {
            return null;
        }
        LocalDate date = today.plusDays(Long.parseLong(match.group(1)));
        return match.group(2) == null ? date.toString() : "%sT%s:%s:00".formatted(date, match.group(2), match.group(3));
    }

    /** Replaces every token in a JSON tree, in place, and returns the same node. */
    public static JsonNode resolveAll(JsonNode node, LocalDate today) {
        if (node instanceof ObjectNode object) {
            List<Map.Entry<String, JsonNode>> fields = new ArrayList<>();
            object.fields().forEachRemaining(fields::add);
            for (Map.Entry<String, JsonNode> field : fields) {
                object.set(field.getKey(), resolveValue(field.getValue(), today));
            }
        } else if (node instanceof ArrayNode array) {
            for (int i = 0; i < array.size(); i++) {
                array.set(i, resolveValue(array.get(i), today));
            }
        }
        return node;
    }

    private static JsonNode resolveValue(JsonNode value, LocalDate today) {
        if (value.isTextual()) {
            String resolved = resolve(value.asText(), today);
            return resolved == null ? value : TextNode.valueOf(resolved);
        }
        return resolveAll(value, today);
    }
}
