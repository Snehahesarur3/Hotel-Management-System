package com.hotel.service.impl;

import com.hotel.calculation.ReportCalculator;
import com.hotel.dto.ReportDtos.GuestReport;
import com.hotel.dto.ReportDtos.OccupancyReport;
import com.hotel.dto.ReportDtos.PaymentReport;
import com.hotel.dto.ReportDtos.ReportRange;
import com.hotel.dto.ReportDtos.ReservationReport;
import com.hotel.dto.ReportDtos.RevenueReport;
import com.hotel.enums.ReportGrouping;
import com.hotel.service.ReportService;
import com.hotel.store.DataStore;
import com.hotel.store.HotelClock;
import com.hotel.util.InputValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;

/**
 * Reports (rules in {@link ReportCalculator}). Ranges are validated like the frontend's report filters
 * (schemas/reports.ts): real yyyy-MM-dd dates, end on or after start, at most 731 days; daily revenue at most 93 days.
 */
@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements ReportService {

    public static final int MAX_REPORT_DAYS = 731;
    public static final int MAX_DAILY_DAYS = 93;

    private final DataStore store;
    private final HotelClock clock;

    @Override
    public RevenueReport revenue(String from, String to, ReportGrouping groupBy) {
        InputValidator v = new InputValidator();
        ReportRange range = range(v, from, to);
        v.required("groupBy", groupBy, "Choose daily, monthly or yearly");
        if (range != null && groupBy == ReportGrouping.DAY && days(range) > MAX_DAILY_DAYS) {
            v.reject("groupBy", "Daily breakdowns cover at most " + MAX_DAILY_DAYS + " days");
        }
        v.throwIfInvalid();
        return store.read(db -> ReportCalculator.revenue(db, range, groupBy));
    }

    @Override
    public OccupancyReport occupancy(String from, String to) {
        ReportRange range = validRange(from, to);
        return store.read(db -> ReportCalculator.occupancy(db, range, clock.today()));
    }

    @Override
    public ReservationReport reservations(String from, String to) {
        ReportRange range = validRange(from, to);
        return store.read(db -> ReportCalculator.reservations(db, range));
    }

    @Override
    public GuestReport guests(String from, String to) {
        ReportRange range = validRange(from, to);
        return store.read(db -> ReportCalculator.guests(db, range));
    }

    @Override
    public PaymentReport payments(String from, String to) {
        ReportRange range = validRange(from, to);
        return store.read(db -> ReportCalculator.payments(db, range));
    }

    private ReportRange validRange(String from, String to) {
        InputValidator v = new InputValidator();
        ReportRange range = range(v, from, to);
        v.throwIfInvalid();
        return range;
    }

    /** Parses and checks the range; returns null (with errors recorded) when it is not usable. */
    private static ReportRange range(InputValidator v, String from, String to) {
        LocalDate start = date(v, "from", from, "start date");
        LocalDate end = date(v, "to", to, "end date");
        if (start == null || end == null) {
            return null;
        }
        ReportRange range = new ReportRange(start, end);
        if (end.isBefore(start)) {
            v.reject("to", "The end date must be on or after the start date");
        } else if (days(range) > MAX_REPORT_DAYS) {
            v.reject("to", "Reports cover at most " + MAX_REPORT_DAYS + " days");
        }
        return v.isValid() ? range : null;
    }

    private static LocalDate date(InputValidator v, String field, String value, String label) {
        if (value == null || !InputValidator.ISO_DATE.matcher(value).matches()) {
            v.reject(field, "Choose the " + label);
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            v.reject(field, "Choose a valid " + label);
            return null;
        }
    }

    private static long days(ReportRange range) {
        return ChronoUnit.DAYS.between(range.from(), range.to()) + 1;
    }
}
