package com.hotel.repository.inmemory;

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
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * One in-memory repository per collection. Services depend on {@code BaseRepository<Entity>} only,
 * so swapping these beans for JPA repositories does not touch the service layer.
 * The id prefixes match the seed and the frontend mock services (RM-101, BK-0041, PAY-0026...).
 */
@Configuration
public class InMemoryRepositoryConfig {

    @Bean
    public BaseRepository<Room> roomRepository() {
        return new InMemoryRepository<>("RM", Room::copy) { };
    }

    @Bean
    public BaseRepository<Guest> guestRepository() {
        return new InMemoryRepository<>("GST", Guest::copy) { };
    }

    @Bean
    public BaseRepository<Reservation> reservationRepository() {
        return new InMemoryRepository<>("BK", Reservation::copy) { };
    }

    @Bean
    public BaseRepository<Payment> paymentRepository() {
        return new InMemoryRepository<>("PAY", Payment::copy) { };
    }

    @Bean
    public BaseRepository<StaffMember> staffRepository() {
        return new InMemoryRepository<>("STF", StaffMember::copy) { };
    }

    @Bean
    public BaseRepository<MenuItem> menuItemRepository() {
        return new InMemoryRepository<>("MNU", MenuItem::copy) { };
    }

    @Bean
    public BaseRepository<RestaurantOrder> restaurantOrderRepository() {
        return new InMemoryRepository<>("ORD", RestaurantOrder::copy) { };
    }

    @Bean
    public BaseRepository<InventoryItem> inventoryRepository() {
        return new InMemoryRepository<>("INV", InventoryItem::copy) { };
    }

    @Bean
    public BaseRepository<StockMovement> stockMovementRepository() {
        return new InMemoryRepository<>("STK", StockMovement::copy) { };
    }

    @Bean
    public BaseRepository<HousekeepingTask> housekeepingTaskRepository() {
        return new InMemoryRepository<>("HK", HousekeepingTask::copy) { };
    }

    @Bean
    public BaseRepository<BillAdjustment> billAdjustmentRepository() {
        return new InMemoryRepository<>("ADJ", BillAdjustment::copy) { };
    }
}
