package com.hotel.service.impl;

import com.hotel.dto.SettingsDtos.SettingsInput;
import com.hotel.entity.HotelSettings;
import com.hotel.entity.HotelSettings.HotelProfile;
import com.hotel.repository.SettingsRepository;
import com.hotel.service.SettingsService;
import com.hotel.store.DataStore;
import com.hotel.util.InputValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Mirrors the frontend mock settings service (frontend/src/mock/services/settings.ts) and schema (schemas/settings.ts).
 * Only the profile and the check-in/check-out times change; the new profile appears on every invoice.
 */
@Service
@RequiredArgsConstructor
public class SettingsServiceImpl implements SettingsService {

    /** 2-digit state code, PAN (5 letters, 4 digits, 1 letter), entity number, "Z", check character. */
    static final Pattern GSTIN = Pattern.compile("^\\d{2}[A-Z]{5}\\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
    static final Pattern TIME = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");

    private final DataStore store;
    private final SettingsRepository settings;

    @Override
    public HotelSettings get() {
        return store.read(db -> db.settings());
    }

    @Override
    public HotelSettings update(SettingsInput raw) {
        SettingsInput input = validate(raw);
        return store.write(() -> {
            HotelSettings current = settings.get();
            HotelSettings updated = new HotelSettings(current.seedVersion(),
                    new HotelProfile(input.name(), input.address(), input.phone(), input.email(), input.gstin()),
                    current.currency(), current.timezone(), input.checkInTime(), input.checkOutTime(), current.taxes());
            settings.save(updated);
            return updated;
        });
    }

    static SettingsInput validate(SettingsInput input) {
        InputValidator v = new InputValidator();
        String email = input.email() == null ? "" : input.email().toLowerCase(Locale.ROOT);
        String gstin = input.gstin() == null ? "" : input.gstin().replaceAll("\\s", "").toUpperCase(Locale.ROOT);
        v.text("name", input.name()).min(2, "Enter the hotel name").max(80, "At most 80 characters");
        v.text("address", input.address()).min(5, "Enter the address").max(200, "At most 200 characters");
        v.text("phone", input.phone()).matches(InputValidator.PHONE, "Enter a valid phone number, e.g. +91 832 000 0100")
                .satisfies(p -> p.replaceAll("\\D", "").length() >= 7, "Enter a valid phone number, e.g. +91 832 000 0100");
        v.text("email", email).matches(InputValidator.EMAIL, "Enter a valid email address").max(120, "Enter a valid email address");
        v.text("gstin", gstin).matches(GSTIN, "Enter the 15-character GSTIN, e.g. 30ABCDE1234F1Z5");
        v.text("checkInTime", input.checkInTime()).matches(TIME, "Use 24-hour time, e.g. 14:00");
        v.text("checkOutTime", input.checkOutTime()).matches(TIME, "Use 24-hour time, e.g. 11:00");
        if (!v.has("checkInTime") && !v.has("checkOutTime") && input.checkOutTime().compareTo(input.checkInTime()) >= 0) {
            v.reject("checkOutTime", "Check-out must be earlier than check-in, to leave time to clean the room");
        }
        v.throwIfInvalid();
        return new SettingsInput(input.name(), input.address(), input.phone(), email, gstin, input.checkInTime(), input.checkOutTime());
    }
}
