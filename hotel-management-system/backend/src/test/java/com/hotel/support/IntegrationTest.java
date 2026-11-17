package com.hotel.support;

import com.hotel.seed.MockDataInitializer;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * Full application with the clock pinned to 11 Nov 2026, 10:00 hotel time (the date the frontend tests use),
 * and a fresh copy of the seed before every test, so tests never see each other's changes.
 * <p>
 * Seed facts used by the tests (relative to that date):
 * BK-0027/28/29 arrive today (rooms 104, 304, 408 are Reserved); BK-0015, BK-0016 and BK-0020 leave today;
 * 14 stays are in-house; room 107 is in Cleaning with one checkout clean in progress (HK-0001);
 * Sunil Parab (STF-0007) has open housekeeping tasks; PAY-0024 is a pending bank transfer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(IntegrationTest.FixedClock.class)
public abstract class IntegrationTest {

    public static final ZoneId HOTEL_ZONE = ZoneId.of("Asia/Kolkata");
    public static final LocalDate TODAY = SeedFixture.TODAY;

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    private MockDataInitializer seed;

    @BeforeEach
    void loadFreshSeed() {
        seed.reload();
    }

    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(ZonedDateTime.of(TODAY.atTime(10, 0), HOTEL_ZONE).toInstant(), HOTEL_ZONE);
        }
    }
}
