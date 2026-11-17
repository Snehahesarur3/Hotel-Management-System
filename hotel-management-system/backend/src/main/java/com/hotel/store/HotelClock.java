package com.hotel.store;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/** Today's date and the current time in the hotel's time zone (see {@code app.timezone}). */
@Component
public class HotelClock {

    private final Clock clock;

    public HotelClock(Clock clock) {
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.now(clock);
    }

    /** Current local date-time to the second, as stored on records (yyyy-MM-ddTHH:mm:ss). */
    public LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(ChronoUnit.SECONDS);
    }
}
