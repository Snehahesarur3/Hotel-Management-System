package com.hotel.service;

import com.hotel.dto.SettingsDtos.SettingsInput;
import com.hotel.entity.HotelSettings;
import com.hotel.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;

import static com.hotel.support.ApiAssertions.invalid;
import static org.assertj.core.api.Assertions.assertThat;

class SettingsServiceTest extends IntegrationTest {

    @Autowired
    private SettingsService settings;

    @Autowired
    private BillingService billing;

    private static SettingsInput input(String gstin, String checkIn, String checkOut) {
        return new SettingsInput("Aurelia Bay Resort", "14 Marine Crescent, Panaji, Goa", "+91 832 000 0199",
                "Stay@AureliaBay.example", gstin, checkIn, checkOut);
    }

    @Test
    void returnsTheSeededProfileAndTaxes() {
        HotelSettings current = settings.get();
        assertThat(current.hotel().name()).isEqualTo("Aurelia Bay Hotel");
        assertThat(current.timezone()).isEqualTo("Asia/Kolkata");
        assertThat(current.taxes().roomGstSlabs()).extracting(HotelSettings.GstSlab::percent).containsExactly(12, 18);
        assertThat(current.taxes().foodGstPercent()).isEqualTo(5);
    }

    @Test
    void updatesTheProfileAndTimesButNeverTheTaxes() {
        HotelSettings before = settings.get();
        HotelSettings updated = settings.update(input(" 30abcde1234f1z5 ", "15:00", "10:30"));

        assertThat(updated.hotel().name()).isEqualTo("Aurelia Bay Resort");
        assertThat(updated.hotel().email()).isEqualTo("stay@aureliabay.example");
        assertThat(updated.hotel().gstin()).isEqualTo("30ABCDE1234F1Z5");
        assertThat(updated.checkInTime()).isEqualTo("15:00");
        assertThat(updated.checkOutTime()).isEqualTo("10:30");
        assertThat(updated.taxes()).isEqualTo(before.taxes());
        assertThat(updated.currency()).isEqualTo(before.currency());
        assertThat(updated.seedVersion()).isEqualTo(before.seedVersion());

        // Invoices show the current profile.
        assertThat(billing.invoice("BK-0013").hotel().name()).isEqualTo("Aurelia Bay Resort");
    }

    @Test
    void validatesLikeTheForm() {
        invalid(() -> settings.update(new SettingsInput("", "", "12", "nope", "GST123", "2pm", "")), Map.of(
                "name", "Enter the hotel name",
                "address", "Enter the address",
                "phone", "Enter a valid phone number, e.g. +91 832 000 0100",
                "email", "Enter a valid email address",
                "gstin", "Enter the 15-character GSTIN, e.g. 30ABCDE1234F1Z5",
                "checkInTime", "Use 24-hour time, e.g. 14:00",
                "checkOutTime", "Use 24-hour time, e.g. 11:00"));
        invalid(() -> settings.update(input("30ABCDE1234F1Z5", "11:00", "12:00")),
                Map.of("checkOutTime", "Check-out must be earlier than check-in, to leave time to clean the room"));
        assertThat(settings.get().hotel().name()).isEqualTo("Aurelia Bay Hotel");
    }
}
