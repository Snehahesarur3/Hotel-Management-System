package com.hotel.calculation;

import com.hotel.dto.ReservationDtos.StayQuote;
import com.hotel.entity.HotelSettings.GstSlab;
import com.hotel.util.MoneyUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Room tariffs and GST (frontend utils/charges.ts). Indian hotel GST is slabbed on the nightly
 * rate, not on the bill total: 12% up to ₹7,500 a night and 18% above, per the hotel settings.
 */
public final class Pricing {

    private Pricing() {
    }

    /** GST percentage for a nightly rate: the first slab whose upper bound covers the rate. */
    public static int roomGstPercent(BigDecimal rate, List<GstSlab> slabs) {
        return slabs.stream()
                .filter(s -> s.maxRate() == null || rate.compareTo(s.maxRate()) <= 0)
                .findFirst()
                .map(GstSlab::percent)
                .orElse(0);
    }

    /** Room charges and GST for a stay at a fixed nightly rate. */
    public static StayQuote quoteStay(BigDecimal rate, LocalDate checkIn, LocalDate checkOut, List<GstSlab> slabs) {
        int nights = (int) Math.max(0, ChronoUnit.DAYS.between(checkIn, checkOut));
        BigDecimal roomCharges = MoneyUtils.multiply(rate, nights);
        int gstPercent = roomGstPercent(rate, slabs);
        BigDecimal gstAmount = MoneyUtils.percentOf(roomCharges, BigDecimal.valueOf(gstPercent));
        return new StayQuote(nights, MoneyUtils.scale(rate), roomCharges, gstPercent, gstAmount,
                MoneyUtils.scale(roomCharges.add(gstAmount)));
    }
}
