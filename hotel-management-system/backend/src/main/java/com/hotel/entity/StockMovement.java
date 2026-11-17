package com.hotel.entity;

import com.hotel.enums.StockMovementType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** A recorded stock-in or stock-out, with the balance after it. */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class StockMovement implements Identifiable {

    private String id;
    private String itemId;
    private StockMovementType type;
    /** Always positive; the type gives the direction. */
    private int quantity;
    private String reason;
    private int balanceAfter;
    private LocalDateTime createdAt;

    /** Detached copy (the repository never hands out its stored instance). */
    public StockMovement copy() {
        return toBuilder().build();
    }
}
