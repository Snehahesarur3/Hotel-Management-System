package com.hotel.entity;

import com.hotel.enums.InventoryCategory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/** A stock-keeping item. Quantity only changes through stock movements. */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class InventoryItem implements Identifiable {

    private String id;
    private String name;
    private InventoryCategory category;
    private String unit;
    private int quantity;
    private int minStockLevel;
    private BigDecimal unitCost;
    private Supplier supplier;
    private LocalDate lastRestocked;

    public record Supplier(String name, String contactPerson, String phone, String email) {
    }

    /** Detached copy (the repository never hands out its stored instance). */
    public InventoryItem copy() {
        return toBuilder().build();
    }
}
