package com.hotel.store;

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

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * A consistent, read-only view of every collection, taken under the {@link DataStore} lock.
 * Calculations (summaries, bills, dashboard, reports) are pure functions of a HotelData,
 * which keeps them easy to unit test with the seed.
 */
public final class HotelData {

    private final HotelSettings settings;
    private final List<Room> rooms;
    private final List<Guest> guests;
    private final List<Reservation> reservations;
    private final List<Payment> payments;
    private final List<StaffMember> staff;
    private final List<MenuItem> menuItems;
    private final List<RestaurantOrder> restaurantOrders;
    private final List<InventoryItem> inventory;
    private final List<HousekeepingTask> housekeepingTasks;
    private final List<BillAdjustment> billAdjustments;
    private final List<StockMovement> stockMovements;

    private final Map<String, Room> roomsById;
    private final Map<String, Guest> guestsById;
    private final Map<String, Reservation> reservationsById;
    private final Map<String, StaffMember> staffById;
    private final Map<String, MenuItem> menuItemsById;

    @SuppressWarnings("java:S107") // one argument per collection, mirroring the frontend MockDatabase
    public HotelData(HotelSettings settings, List<Room> rooms, List<Guest> guests, List<Reservation> reservations,
                     List<Payment> payments, List<StaffMember> staff, List<MenuItem> menuItems,
                     List<RestaurantOrder> restaurantOrders, List<InventoryItem> inventory,
                     List<HousekeepingTask> housekeepingTasks, List<BillAdjustment> billAdjustments,
                     List<StockMovement> stockMovements) {
        this.settings = settings;
        this.rooms = List.copyOf(rooms);
        this.guests = List.copyOf(guests);
        this.reservations = List.copyOf(reservations);
        this.payments = List.copyOf(payments);
        this.staff = List.copyOf(staff);
        this.menuItems = List.copyOf(menuItems);
        this.restaurantOrders = List.copyOf(restaurantOrders);
        this.inventory = List.copyOf(inventory);
        this.housekeepingTasks = List.copyOf(housekeepingTasks);
        this.billAdjustments = List.copyOf(billAdjustments);
        this.stockMovements = List.copyOf(stockMovements);
        this.roomsById = index(this.rooms);
        this.guestsById = index(this.guests);
        this.reservationsById = index(this.reservations);
        this.staffById = index(this.staff);
        this.menuItemsById = index(this.menuItems);
    }

    private static <T extends Identifiable> Map<String, T> index(List<T> items) {
        return items.stream().collect(Collectors.toUnmodifiableMap(Identifiable::getId, Function.identity()));
    }

    public HotelSettings settings() { return settings; }
    public List<Room> rooms() { return rooms; }
    public List<Guest> guests() { return guests; }
    public List<Reservation> reservations() { return reservations; }
    public List<Payment> payments() { return payments; }
    public List<StaffMember> staff() { return staff; }
    public List<MenuItem> menuItems() { return menuItems; }
    public List<RestaurantOrder> restaurantOrders() { return restaurantOrders; }
    public List<InventoryItem> inventory() { return inventory; }
    public List<HousekeepingTask> housekeepingTasks() { return housekeepingTasks; }
    public List<BillAdjustment> billAdjustments() { return billAdjustments; }
    public List<StockMovement> stockMovements() { return stockMovements; }

    /** Lookups return null for an unknown id (callers fall back to "Unknown guest", "—"...). */
    public Room room(String id) { return id == null ? null : roomsById.get(id); }
    public Guest guest(String id) { return id == null ? null : guestsById.get(id); }
    public Reservation reservation(String id) { return id == null ? null : reservationsById.get(id); }
    public StaffMember staffMember(String id) { return id == null ? null : staffById.get(id); }
    public MenuItem menuItem(String id) { return id == null ? null : menuItemsById.get(id); }
}
