package com.hotel.controller;

import com.hotel.dto.SettingsDtos.SettingsInput;
import com.hotel.entity.HotelSettings;
import com.hotel.service.SettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Settings", description = "Hotel profile, check-in/check-out times and tax configuration")
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settings;

    @GetMapping
    public HotelSettings get() {
        return settings.get();
    }

    @Operation(summary = "Update the hotel profile and check-in/check-out times (Admin). Tax rates are not editable.")
    @PutMapping
    public HotelSettings update(@RequestBody SettingsInput input) {
        return settings.update(input);
    }
}
