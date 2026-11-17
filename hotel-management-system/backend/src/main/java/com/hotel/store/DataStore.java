package com.hotel.store;

import com.hotel.entity.BillAdjustment;
import com.hotel.entity.Guest;
import com.hotel.entity.HousekeepingTask;
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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * Gives services a consistent view of the data and makes multi-step changes atomic.
 * <p>
 * Repositories are thread-safe per call, but business operations read several collections,
 * check rules, then write several records (check-out: stay, payment, room, cleaning task).
 * {@link #write} runs such an operation under an exclusive lock, so no other request can
 * interleave between the checks and the writes; {@link #read} lets queries run in parallel.
 * Services check every rule before the first write, so a rejected request changes nothing.
 */
@Component
@RequiredArgsConstructor
public class DataStore {

    private final ReadWriteLock lock = new ReentrantReadWriteLock(true);

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

    /** Runs a query against a consistent snapshot. */
    public <T> T read(Function<HotelData, T> query) {
        lock.readLock().lock();
        try {
            return query.apply(snapshot());
        } finally {
            lock.readLock().unlock();
        }
    }

    /** Runs a command exclusively. Inside it, call {@link #snapshot()} for the current state. */
    public <T> T write(Supplier<T> command) {
        lock.writeLock().lock();
        try {
            return command.get();
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void write(Runnable command) {
        write(() -> {
            command.run();
            return null;
        });
    }

    /** Copies every collection. Call it inside {@link #read} or {@link #write}. */
    public HotelData snapshot() {
        return new HotelData(settings.get(), rooms.findAll(), guests.findAll(), reservations.findAll(),
                payments.findAll(), staff.findAll(), menuItems.findAll(), restaurantOrders.findAll(),
                inventory.findAll(), housekeepingTasks.findAll(), billAdjustments.findAll(), stockMovements.findAll());
    }
}
