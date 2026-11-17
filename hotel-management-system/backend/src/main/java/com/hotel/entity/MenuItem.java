package com.hotel.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.hotel.enums.MenuCategory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** A dish on the restaurant menu. */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class MenuItem implements Identifiable {

    private String id;
    private String name;
    private MenuCategory category;
    private BigDecimal price;
    /** Serialised as "isVegetarian", like the frontend type. */
    @JsonProperty("isVegetarian")
    private boolean vegetarian;
    private boolean available;

    /** Detached copy (the repository never hands out its stored instance). */
    public MenuItem copy() {
        return toBuilder().build();
    }
}
