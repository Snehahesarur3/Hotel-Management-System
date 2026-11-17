package com.hotel.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

/**
 * The single source of "now". Services ask this clock for today's date, so tests can pin it
 * and every business-day boundary (today's arrivals, this month's revenue) follows the hotel's time zone.
 */
@Configuration
public class TimeConfig {

    @Bean
    public Clock clock(@Value("${app.timezone:Asia/Kolkata}") String timezone) {
        return Clock.system(ZoneId.of(timezone));
    }
}
