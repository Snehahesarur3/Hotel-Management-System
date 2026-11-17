package com.hotel.util;

import com.hotel.dto.PageResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UtilsTest {

    private final List<Integer> items = IntStream.rangeClosed(1, 45).boxed().toList();

    @Test
    void paginatesMiddleAndLastPage() {
        PageResponse<Integer> second = PageUtils.paginate(items, 1, 20);
        assertThat(second.content()).first().isEqualTo(21);
        assertThat(second.totalPages()).isEqualTo(3);
        assertThat(second.totalElements()).isEqualTo(45);

        assertThat(PageUtils.paginate(items, 2, 20).content()).containsExactly(41, 42, 43, 44, 45);
    }

    @Test
    void pageBeyondEndIsEmpty() {
        assertThat(PageUtils.paginate(items, 10, 20).content()).isEmpty();
    }

    @Test
    void rejectsInvalidPaging() {
        assertThatThrownBy(() -> PageUtils.paginate(items, -1, 20)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PageUtils.paginate(items, 0, 0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PageUtils.paginate(items, 0, 500)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void moneyCalculationsUseTwoDecimalHalfUp() {
        assertThat(MoneyUtils.multiply(new BigDecimal("2499.50"), 3)).isEqualByComparingTo("7498.50");
        assertThat(MoneyUtils.percentOf(new BigDecimal("7498.50"), new BigDecimal("12"))).isEqualByComparingTo("899.82");
        assertThat(MoneyUtils.percentOf(new BigDecimal("0.05"), new BigDecimal("50"))).isEqualByComparingTo("0.03");
        assertThat(MoneyUtils.scale(null)).isEqualByComparingTo("0.00");
    }
}
