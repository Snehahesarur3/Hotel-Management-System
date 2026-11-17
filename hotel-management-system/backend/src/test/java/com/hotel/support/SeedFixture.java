package com.hotel.support;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.hotel.entity.BillAdjustment;
import com.hotel.entity.Guest;
import com.hotel.entity.HotelSettings;
import com.hotel.entity.HousekeepingTask;
import com.hotel.entity.InventoryItem;
import com.hotel.entity.MenuItem;
import com.hotel.entity.Payment;
import com.hotel.entity.Reservation;
import com.hotel.entity.RestaurantOrder;
import com.hotel.entity.Room;
import com.hotel.entity.StaffMember;
import com.hotel.entity.StockMovement;
import com.hotel.seed.DateTokens;
import com.hotel.store.HotelData;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * The canonical seed as a {@link HotelData}, resolved against a fixed date, for pure calculation tests.
 * The frontend's calculation tests use the same seed and date (2026-11-11), so the expected figures match.
 */
public final class SeedFixture {

    public static final LocalDate TODAY = LocalDate.of(2026, 11, 11);

    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .findAndAddModules()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private SeedFixture() {
    }

    public static HotelData load() {
        return load(TODAY);
    }

    public static HotelData load(LocalDate today) {
        return new Builder(today).build();
    }

    /** Seed data that a test can change before building the snapshot. */
    public static Builder builder() {
        return new Builder(TODAY);
    }

    public static final class Builder {
        public final HotelSettings settings;
        public final List<Room> rooms;
        public final List<Guest> guests;
        public final List<Reservation> reservations;
        public final List<Payment> payments;
        public final List<StaffMember> staff;
        public final List<MenuItem> menuItems;
        public final List<RestaurantOrder> orders;
        public final List<InventoryItem> inventory;
        public final List<HousekeepingTask> tasks;
        public final List<BillAdjustment> adjustments = new ArrayList<>();
        public final List<StockMovement> movements = new ArrayList<>();

        private Builder(LocalDate today) {
            settings = MAPPER.convertValue(read("settings.json", today), HotelSettings.class);
            rooms = list("rooms.json", today, new TypeReference<>() { });
            guests = list("guests.json", today, new TypeReference<>() { });
            reservations = list("reservations.json", today, new TypeReference<>() { });
            payments = list("payments.json", today, new TypeReference<>() { });
            staff = list("staff.json", today, new TypeReference<>() { });
            menuItems = list("menu-items.json", today, new TypeReference<>() { });
            orders = list("restaurant-orders.json", today, new TypeReference<>() { });
            inventory = list("inventory.json", today, new TypeReference<>() { });
            tasks = list("housekeeping-tasks.json", today, new TypeReference<>() { });
        }

        public Builder with(Consumer<Builder> change) {
            change.accept(this);
            return this;
        }

        public HotelData build() {
            return new HotelData(settings, rooms, guests, reservations, payments, staff, menuItems, orders,
                    inventory, tasks, adjustments, movements);
        }
    }

    private static <T> List<T> list(String file, LocalDate today, TypeReference<List<T>> type) {
        return new ArrayList<>(MAPPER.convertValue(read(file, today), type));
    }

    private static JsonNode read(String file, LocalDate today) {
        try (InputStream in = SeedFixture.class.getResourceAsStream("/seed/" + file)) {
            if (in == null) {
                throw new IllegalStateException("Seed file not on the classpath: " + file);
            }
            return DateTokens.resolveAll(MAPPER.readTree(in), today);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
