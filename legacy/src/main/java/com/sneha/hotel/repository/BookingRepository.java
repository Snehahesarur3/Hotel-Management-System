package com.sneha.hotel.repository;

import com.sneha.hotel.entity.Booking;
import com.sneha.hotel.entity.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    // JOIN FETCH loads room + customer in one query, avoiding the N+1 problem
    @Query("SELECT b FROM Booking b JOIN FETCH b.room JOIN FETCH b.customer WHERE b.customer.id = :customerId")
    List<Booking> findByCustomerIdWithDetails(@Param("customerId") Long customerId);

    @Query("SELECT b FROM Booking b JOIN FETCH b.room JOIN FETCH b.customer")
    List<Booking> findAllWithDetails();

    @Query("""
           SELECT COUNT(b) > 0 FROM Booking b
           WHERE b.room.id = :roomId
             AND b.status IN (com.sneha.hotel.entity.BookingStatus.CONFIRMED,
                              com.sneha.hotel.entity.BookingStatus.CHECKED_IN)
             AND b.checkIn < :checkOut
             AND b.checkOut > :checkIn
           """)
    boolean hasOverlappingBooking(@Param("roomId") Long roomId,
                                  @Param("checkIn") LocalDate checkIn,
                                  @Param("checkOut") LocalDate checkOut);

    boolean existsByRoomId(Long roomId);

    long countByStatus(BookingStatus status);
}
