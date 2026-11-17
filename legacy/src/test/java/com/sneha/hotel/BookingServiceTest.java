package com.sneha.hotel;

import com.sneha.hotel.dto.BookingRequest;
import com.sneha.hotel.dto.BookingResponse;
import com.sneha.hotel.entity.BookingStatus;
import com.sneha.hotel.exception.BusinessException;
import com.sneha.hotel.service.BookingService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional // each test rolls back, so tests don't affect each other
class BookingServiceTest {

    @Autowired
    private BookingService bookingService;

    private final LocalDate start = LocalDate.now().plusDays(10);

    @Test
    void createsBookingAndCalculatesTotal() {
        // Room 1 (101, SINGLE) costs 1500/night; 3 nights = 4500
        BookingResponse res = bookingService.createBooking(
                new BookingRequest(1L, 1L, start, start.plusDays(3), 1));

        assertEquals(3, res.nights());
        assertEquals(0, new BigDecimal("4500.00").compareTo(res.totalAmount()));
        assertEquals(BookingStatus.CONFIRMED, res.status());
    }

    @Test
    void rejectsOverlappingBooking() {
        bookingService.createBooking(new BookingRequest(3L, 1L, start, start.plusDays(3), 2));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                bookingService.createBooking(new BookingRequest(3L, 2L, start.plusDays(1), start.plusDays(4), 2)));
        assertTrue(ex.getMessage().contains("already booked"));
    }

    @Test
    void allowsBackToBackBookings() {
        // Checkout day of one guest can be the check-in day of the next
        bookingService.createBooking(new BookingRequest(4L, 1L, start, start.plusDays(2), 1));
        assertDoesNotThrow(() ->
                bookingService.createBooking(new BookingRequest(4L, 2L, start.plusDays(2), start.plusDays(4), 1)));
    }

    @Test
    void cancelledBookingFreesTheRoom() {
        BookingResponse first = bookingService.createBooking(new BookingRequest(5L, 1L, start, start.plusDays(2), 2));
        bookingService.cancel(first.bookingId());

        assertDoesNotThrow(() ->
                bookingService.createBooking(new BookingRequest(5L, 2L, start, start.plusDays(2), 2)));
    }

    @Test
    void rejectsTooManyGuests() {
        // Room 1 is SINGLE (capacity 1)
        assertThrows(BusinessException.class, () ->
                bookingService.createBooking(new BookingRequest(1L, 1L, start, start.plusDays(1), 3)));
    }
}
