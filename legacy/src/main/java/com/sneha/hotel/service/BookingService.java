package com.sneha.hotel.service;

import com.sneha.hotel.dto.BookingRequest;
import com.sneha.hotel.dto.BookingResponse;
import com.sneha.hotel.dto.DashboardResponse;
import com.sneha.hotel.entity.Booking;
import com.sneha.hotel.entity.BookingStatus;
import com.sneha.hotel.entity.Customer;
import com.sneha.hotel.entity.Room;
import com.sneha.hotel.exception.BusinessException;
import com.sneha.hotel.exception.ResourceNotFoundException;
import com.sneha.hotel.repository.BookingRepository;
import com.sneha.hotel.repository.CustomerRepository;
import com.sneha.hotel.repository.RoomRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final RoomRepository roomRepository;
    private final CustomerRepository customerRepository;

    public BookingService(BookingRepository bookingRepository,
                          RoomRepository roomRepository,
                          CustomerRepository customerRepository) {
        this.bookingRepository = bookingRepository;
        this.roomRepository = roomRepository;
        this.customerRepository = customerRepository;
    }

    /**
     * Creates a booking. The whole method runs in one transaction:
     * lock room -> check overlap -> save. If anything fails, nothing is saved.
     */
    @Transactional
    public BookingResponse createBooking(BookingRequest req) {
        if (!req.checkOut().isAfter(req.checkIn())) {
            throw new BusinessException("Check-out date must be after check-in date");
        }

        // Row lock prevents two users booking the same room at the same moment
        Room room = roomRepository.findByIdForUpdate(req.roomId())
                .orElseThrow(() -> new ResourceNotFoundException("Room", req.roomId()));
        if (!room.isActive()) {
            throw new BusinessException("Room " + room.getRoomNumber() + " is not available for booking");
        }
        if (req.guests() > room.getCapacity()) {
            throw new BusinessException("Room " + room.getRoomNumber() + " allows max " + room.getCapacity() + " guests");
        }

        Customer customer = customerRepository.findById(req.customerId())
                .orElseThrow(() -> new ResourceNotFoundException("Customer", req.customerId()));

        if (bookingRepository.hasOverlappingBooking(room.getId(), req.checkIn(), req.checkOut())) {
            throw new BusinessException("Room " + room.getRoomNumber() + " is already booked for these dates");
        }

        long nights = ChronoUnit.DAYS.between(req.checkIn(), req.checkOut());

        Booking booking = new Booking();
        booking.setRoom(room);
        booking.setCustomer(customer);
        booking.setCheckIn(req.checkIn());
        booking.setCheckOut(req.checkOut());
        booking.setGuests(req.guests());
        booking.setTotalAmount(room.getPricePerNight().multiply(BigDecimal.valueOf(nights)));

        return BookingResponse.from(bookingRepository.save(booking));
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getAll() {
        return bookingRepository.findAllWithDetails().stream()
                .map(BookingResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public BookingResponse get(Long id) {
        return BookingResponse.from(find(id));
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getByCustomer(Long customerId) {
        if (!customerRepository.existsById(customerId)) {
            throw new ResourceNotFoundException("Customer", customerId);
        }
        return bookingRepository.findByCustomerIdWithDetails(customerId).stream()
                .map(BookingResponse::from)
                .toList();
    }

    @Transactional
    public BookingResponse cancel(Long id) {
        Booking b = find(id);
        if (b.getStatus() != BookingStatus.CONFIRMED) {
            throw new BusinessException("Only CONFIRMED bookings can be cancelled (current: " + b.getStatus() + ")");
        }
        b.setStatus(BookingStatus.CANCELLED);
        return BookingResponse.from(b);
    }

    @Transactional
    public BookingResponse checkIn(Long id) {
        Booking b = find(id);
        if (b.getStatus() != BookingStatus.CONFIRMED) {
            throw new BusinessException("Only CONFIRMED bookings can be checked in (current: " + b.getStatus() + ")");
        }
        if (LocalDate.now().isBefore(b.getCheckIn())) {
            throw new BusinessException("Check-in is allowed only from " + b.getCheckIn());
        }
        b.setStatus(BookingStatus.CHECKED_IN);
        return BookingResponse.from(b);
    }

    @Transactional
    public BookingResponse checkOut(Long id) {
        Booking b = find(id);
        if (b.getStatus() != BookingStatus.CHECKED_IN) {
            throw new BusinessException("Only CHECKED_IN bookings can be checked out (current: " + b.getStatus() + ")");
        }
        b.setStatus(BookingStatus.CHECKED_OUT);
        return BookingResponse.from(b);
    }

    @Transactional(readOnly = true)
    public DashboardResponse dashboard() {
        return new DashboardResponse(
                roomRepository.findByActiveTrue().size(),
                customerRepository.count(),
                bookingRepository.countByStatus(BookingStatus.CONFIRMED),
                bookingRepository.countByStatus(BookingStatus.CHECKED_IN),
                bookingRepository.countByStatus(BookingStatus.CANCELLED));
    }

    private Booking find(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", id));
    }
}
