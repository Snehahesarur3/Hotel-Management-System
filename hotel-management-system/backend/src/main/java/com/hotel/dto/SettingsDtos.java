package com.hotel.dto;

/** Settings contract (frontend types/settings.ts). Responses are the {@link com.hotel.entity.HotelSettings} record itself. */
public final class SettingsDtos {

    private SettingsDtos() {
    }

    /**
     * PUT /api/settings: the editable part of the settings, the hotel profile and the check-in/check-out times.
     * Currency, time zone and GST rates are fixed configuration: changing tax rates would silently change
     * invoices that were already issued, because bills are calculated from the settings.
     */
    public record SettingsInput(
            String name,
            String address,
            String phone,
            String email,
            String gstin,
            String checkInTime,
            String checkOutTime) {
    }
}
