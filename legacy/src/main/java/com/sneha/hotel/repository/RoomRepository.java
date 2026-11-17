package com.sneha.hotel.repository;

import com.sneha.hotel.entity.Room;
import com.sneha.hotel.entity.RoomType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {

    // Derived query: Spring generates the SQL from the method name
    List<Room> findByActiveTrue();

    List<Room> findByRoomTypeAndActiveTrue(RoomType roomType);

    boolean existsByRoomNumber(String roomNumber);

    /**
     * Rooms with no overlapping active booking for the given dates.
     * Two date ranges overlap when: existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn
     */
    @Query("""
           SELECT r FROM Room r
           WHERE r.active = true
             AND r.capacity >= :guests
             AND r.id NOT IN (
                 SELECT b.room.id FROM Booking b
                 WHERE b.status IN (com.sneha.hotel.entity.BookingStatus.CONFIRMED,
                                    com.sneha.hotel.entity.BookingStatus.CHECKED_IN)
                   AND b.checkIn < :checkOut
                   AND b.checkOut > :checkIn)
           ORDER BY r.pricePerNight
           """)
    List<Room> findAvailableRooms(@Param("checkIn") LocalDate checkIn,
                                  @Param("checkOut") LocalDate checkOut,
                                  @Param("guests") int guests);

    /** Locks the room row so two simultaneous requests cannot double-book it. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM Room r WHERE r.id = :id")
    Optional<Room> findByIdForUpdate(@Param("id") Long id);
}
