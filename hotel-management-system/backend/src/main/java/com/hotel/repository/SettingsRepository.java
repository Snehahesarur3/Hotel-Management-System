package com.hotel.repository;

import com.hotel.entity.HotelSettings;
import org.springframework.stereotype.Repository;

import java.util.concurrent.atomic.AtomicReference;

/** Holds the single hotel settings record (immutable, replaced as a whole). */
@Repository
public class SettingsRepository {

    private final AtomicReference<HotelSettings> settings = new AtomicReference<>();

    public HotelSettings get() {
        HotelSettings current = settings.get();
        if (current == null) {
            throw new IllegalStateException("Hotel settings have not been loaded");
        }
        return current;
    }

    public void save(HotelSettings value) {
        settings.set(value);
    }
}
