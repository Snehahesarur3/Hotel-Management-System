package com.hotel.util;

import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.exception.ValidationException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/** InputValidator, ListQueries, TextMatching and Formats. */
class ValidationAndQueryTest {

    // ------------------------------------------------------------------ validator

    @Test
    void keepsTheFirstBrokenRulePerFieldInFormOrder() {
        InputValidator v = new InputValidator();
        v.text("name", "").min(2, "Enter the name").max(5, "Too long");
        v.text("email", "x@").matches(InputValidator.EMAIL, "Enter a valid email address");
        v.number("price", new BigDecimal("12.345")).required("Enter the price").min(10, "Minimum ₹10").cents("Use at most 2 decimal places");
        v.number("count", null).required("Enter the count").min(1, "At least 1");
        LocalDate date = v.date("on", "2026-02-30", "Choose the date", "Enter a valid date");

        assertThat(date).isNull();
        ValidationException error = catchThrowableOfType(ValidationException.class, v::throwIfInvalid);
        assertThat(error.getFieldErrors()).containsExactly(
                java.util.Map.entry("name", "Enter the name"),
                java.util.Map.entry("email", "Enter a valid email address"),
                java.util.Map.entry("price", "Use at most 2 decimal places"),
                java.util.Map.entry("count", "Enter the count"),
                java.util.Map.entry("on", "Enter a valid date"));
    }

    @Test
    void acceptsValidInputAndCommonPatterns() {
        InputValidator v = new InputValidator();
        v.text("name", "D'Souza-Pereira Jr.").matches(InputValidator.NAME, "bad");
        v.text("email", "rita.fernandes+orders@coastal-linen.example").matches(InputValidator.EMAIL, "bad");
        v.text("phone", "+91 (832) 000-0100").matches(InputValidator.PHONE, "bad");
        v.number("price", new BigDecimal("1500.50")).required("x").min(10, "x").cents("x");
        assertThat(v.isValid()).isTrue();
        assertThat(InputValidator.optionalDate("from", " ")).isNull();
        assertThatThrownBy(() -> InputValidator.optionalDate("from", "11/11/2026")).isInstanceOf(ValidationException.class);
    }

    // ------------------------------------------------------------------ list queries

    record Row(String name, Integer floor) {
    }

    private static final List<Row> ROWS = List.of(new Row("Room 10", 1), new Row("Room 9", null), new Row("José Suite", 3), new Row("room 100", 2));

    private static ListQueries.Spec<Row> spec() {
        return ListQueries.Spec.<Row>of()
                .search(r -> Arrays.asList(r.name(), r.floor()))
                .sortBy("name", Row::name)
                .sortBy("floor", Row::floor)
                .defaultOrder(Comparator.comparing(Row::name, TextMatching.NATURAL));
    }

    @Test
    void sortsNaturallyWithEmptyValuesLastInBothDirections() {
        assertThat(ListQueries.apply(ROWS, ListQuery.all(), spec()).content()).extracting(Row::name)
                .containsExactly("José Suite", "Room 9", "Room 10", "room 100");
        assertThat(ListQueries.apply(ROWS, new ListQuery(null, null, null, "floor,desc"), spec()).content()).extracting(Row::name)
                .containsExactly("José Suite", "room 100", "Room 10", "Room 9");
        assertThat(ListQueries.apply(ROWS, new ListQuery(null, null, null, "floor,asc"), spec()).content()).extracting(Row::name)
                .containsExactly("Room 10", "room 100", "José Suite", "Room 9");
        assertThatThrownBy(() -> ListQueries.apply(ROWS, new ListQuery(null, null, null, "colour,asc"), spec()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void searchesEveryWordIgnoringCaseAndAccents() {
        PageResponse<Row> page = ListQueries.apply(ROWS, new ListQuery(0, 1, "JOSE suite", null), spec());
        assertThat(page.content()).extracting(Row::name).containsExactly("José Suite");
        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(ListQueries.apply(ROWS, new ListQuery(0, 2, "room", null), spec()).totalPages()).isEqualTo(2);
        assertThat(TextMatching.matches(List.of("Aarav Mehta"), "mehta aarav")).isTrue();
        assertThat(TextMatching.matches(List.of("Aarav Mehta"), "mehta zz")).isFalse();
    }

    // ------------------------------------------------------------------ formats

    @Test
    void formatsLikeTheFrontend() {
        assertThat(Formats.currency(new BigDecimal("1234567.5"))).isEqualTo("₹12,34,567.50");
        assertThat(Formats.currency(new BigDecimal("-950"))).isEqualTo("-₹950.00");
        assertThat(Formats.currency(new BigDecimal("16500"))).isEqualTo("₹16,500.00");
        assertThat(Formats.groupIndian("10000000")).isEqualTo("1,00,00,000");
        assertThat(Formats.date(LocalDate.of(2027, 2, 9))).isEqualTo("9 Feb 2027");
        assertThat(Formats.shortDate(LocalDate.of(2026, 11, 13))).isEqualTo("13 Nov");
        assertThat(Formats.label("CHECKED_IN")).isEqualTo("Checked In");
        assertThat(Formats.label("BOOKING_COM")).isEqualTo("Booking.com");
        assertThat(Formats.plural(1, "night")).isEqualTo("1 night");
        assertThat(Formats.plural(3, "night")).isEqualTo("3 nights");
        assertThat(MoneyUtils.percent(1, 3)).isEqualTo(33.3);
        assertThat(MoneyUtils.perUnit(new BigDecimal("435500"), 60)).isEqualByComparingTo("7258.33");
    }
}
