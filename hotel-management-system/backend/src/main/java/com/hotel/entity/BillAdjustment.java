package com.hotel.entity;

import com.hotel.enums.AdjustmentKind;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** An extra charge, or a discount on room charges (fixed amount or percentage), posted to a folio. */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class BillAdjustment implements Identifiable {

    private String id;
    private String reservationId;
    private AdjustmentKind kind;
    private String description;
    /** EXTRA: the charge. DISCOUNT: a fixed discount (null when the discount is a percentage). */
    private BigDecimal amount;
    /** EXTRA only: GST rate (0, 5, 12 or 18). */
    private Integer gstPercent;
    /** DISCOUNT only: percentage of room charges (null when the discount is a fixed amount). */
    private BigDecimal percent;
    private LocalDateTime createdAt;

    /** Detached copy (the repository never hands out its stored instance). */
    public BillAdjustment copy() {
        return toBuilder().build();
    }
}
