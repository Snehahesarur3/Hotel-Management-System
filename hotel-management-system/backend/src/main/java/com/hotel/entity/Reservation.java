package com.hotel.entity;

import com.hotel.enums.BookingSource;
import com.hotel.enums.BookingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** A booking. The nightly rate is locked in when the room is booked. */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Reservation implements Identifiable {

    private String id;
    private String guestId;
    private String roomId;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private int numberOfGuests;
    private BigDecimal roomRate;
    private BookingSource source;
    private BookingStatus status;
    private LocalDateTime createdAt;
    /** Set by the front desk (absent on seeded stays). */
    private LocalDateTime checkedInAt;
    private LocalDateTime checkedOutAt;

    /** Detached copy (the repository never hands out its stored instance). */
    public Reservation copy() {
        return toBuilder().build();
    }
}
