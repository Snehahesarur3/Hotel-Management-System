package com.hotel.entity;

import java.math.BigDecimal;
import java.util.List;

/**
 * Hotel profile and tax configuration (shared/seed/settings.json).
 *
 * @param seedVersion version of the canonical dataset
 */
public record HotelSettings(
        int seedVersion,
        HotelProfile hotel,
        String currency,
        String timezone,
        String checkInTime,
        String checkOutTime,
        Taxes taxes) {

    public HotelSettings {
        taxes = taxes == null ? new Taxes(List.of(), 0) : taxes;
    }

    public record HotelProfile(String name, String address, String phone, String email, String gstin) {
    }

    /**
     * @param roomGstSlabs   slabs on the nightly rate, lowest first
     * @param foodGstPercent GST on restaurant charges
     */
    public record Taxes(List<GstSlab> roomGstSlabs, int foodGstPercent) {
        public Taxes {
            roomGstSlabs = roomGstSlabs == null ? List.of() : List.copyOf(roomGstSlabs);
        }
    }

    /** @param maxRate upper bound of the nightly rate for this slab; null means no upper bound */
    public record GstSlab(BigDecimal maxRate, int percent) {
    }
}
