package com.hotel.service;

import com.hotel.dto.SettingsDtos.SettingsInput;
import com.hotel.entity.HotelSettings;

/** /api/settings: hotel profile, check-in/check-out times, and the (read-only) tax configuration. */
public interface SettingsService {

    HotelSettings get();

    HotelSettings update(SettingsInput input);
}
