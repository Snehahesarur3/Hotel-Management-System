package com.hotel.entity;

import com.hotel.enums.RoomStatus;
import com.hotel.enums.RoomType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/** A bookable room. Status is operational state driven by reservations, check-in/out and housekeeping. */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Room implements Identifiable {

    private String id;
    private String roomNumber;
    private RoomType type;
    private int floor;
    private int capacity;
    private BigDecimal pricePerNight;
    @Builder.Default
    private List<String> amenities = new ArrayList<>();
    private RoomStatus status;
    private String description;

    /** Detached copy (the repository never hands out its stored instance). */
    public Room copy() {
        return toBuilder().amenities(new ArrayList<>(amenities == null ? List.of() : amenities)).build();
    }
}
