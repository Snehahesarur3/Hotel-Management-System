package com.hotel.seed;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotel.entity.BillAdjustment;
import com.hotel.entity.Guest;
import com.hotel.entity.HotelSettings;
import com.hotel.entity.HousekeepingTask;
import com.hotel.entity.Identifiable;
import com.hotel.entity.InventoryItem;
import com.hotel.entity.MenuItem;
import com.hotel.entity.Payment;
import com.hotel.entity.Reservation;
import com.hotel.entity.RestaurantOrder;
import com.hotel.entity.Room;
import com.hotel.entity.StaffMember;
import com.hotel.entity.StockMovement;
import com.hotel.repository.BaseRepository;
import com.hotel.repository.SettingsRepository;
import com.hotel.store.DataStore;
import com.hotel.store.HotelClock;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.util.List;

/**
 * Loads the canonical seed (shared/seed, copied to {@code classpath:seed/} by Maven) into the
 * in-memory repositories at startup, with relative dates resolved against today.
 * The frontend's mock mode loads the same files, so both modes start from identical data.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MockDataInitializer implements ApplicationRunner {

    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;
    private final HotelClock clock;
    private final DataStore store;
    private final SettingsRepository settings;
    private final BaseRepository<Room> rooms;
    private final BaseRepository<Guest> guests;
    private final BaseRepository<Reservation> reservations;
    private final BaseRepository<Payment> payments;
    private final BaseRepository<StaffMember> staff;
    private final BaseRepository<MenuItem> menuItems;
    private final BaseRepository<RestaurantOrder> restaurantOrders;
    private final BaseRepository<InventoryItem> inventory;
    private final BaseRepository<HousekeepingTask> housekeepingTasks;
    private final BaseRepository<BillAdjustment> billAdjustments;
    private final BaseRepository<StockMovement> stockMovements;

    @Value("${app.seed.location:classpath:seed/}")
    private String location;

    @Override
    public void run(ApplicationArguments args) {
        reload();
    }

    /** Discards all data and loads the seed again (also used by tests for a clean start). */
    public void reload() {
        LocalDate today = clock.today();
        store.write(() -> {
            settings.save(objectMapper.convertValue(read("settings.json", today), HotelSettings.class));
            replace(rooms, "rooms.json", today, new TypeReference<>() { });
            replace(guests, "guests.json", today, new TypeReference<>() { });
            replace(reservations, "reservations.json", today, new TypeReference<>() { });
            replace(payments, "payments.json", today, new TypeReference<>() { });
            replace(staff, "staff.json", today, new TypeReference<>() { });
            replace(menuItems, "menu-items.json", today, new TypeReference<>() { });
            replace(restaurantOrders, "restaurant-orders.json", today, new TypeReference<>() { });
            replace(inventory, "inventory.json", today, new TypeReference<>() { });
            replace(housekeepingTasks, "housekeeping-tasks.json", today, new TypeReference<>() { });
            // Not in the seed: created by the API.
            billAdjustments.deleteAll();
            stockMovements.deleteAll();
        });
        log.info("Seed loaded for {}: {} rooms, {} guests, {} reservations, {} payments, {} staff",
                today, rooms.count(), guests.count(), reservations.count(), payments.count(), staff.count());
    }

    private <T extends Identifiable> void replace(BaseRepository<T> repository, String file, LocalDate today,
                                                  TypeReference<List<T>> type) {
        List<T> items = objectMapper.convertValue(read(file, today), type);
        repository.deleteAll();
        repository.saveAll(items);
    }

    private JsonNode read(String file, LocalDate today) {
        String path = location.endsWith("/") ? location + file : location + "/" + file;
        try (InputStream in = resourceLoader.getResource(path).getInputStream()) {
            return DateTokens.resolveAll(objectMapper.readTree(in), today);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read seed file " + path, e);
        }
    }
}
