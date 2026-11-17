package com.hotel.entity;

import com.hotel.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Restaurant or room-service order charged to an in-house stay. */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantOrder implements Identifiable {

    private String id;
    private String reservationId;
    private String roomId;
    @Builder.Default
    private List<OrderLine> items = new ArrayList<>();
    private OrderStatus status;
    private LocalDateTime orderedAt;

    /** One dish on an order, at the price locked in when it was ordered. */
    public record OrderLine(String menuItemId, int quantity, BigDecimal unitPrice) {
    }

    /** Detached copy (the repository never hands out its stored instance). */
    public RestaurantOrder copy() {
        return toBuilder().items(new ArrayList<>(items == null ? List.of() : items)).build();
    }
}
