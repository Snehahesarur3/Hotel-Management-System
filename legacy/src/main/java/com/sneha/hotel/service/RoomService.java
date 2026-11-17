package com.sneha.hotel.service;

import com.sneha.hotel.entity.Room;
import com.sneha.hotel.entity.RoomType;
import com.sneha.hotel.exception.BusinessException;
import com.sneha.hotel.exception.ResourceNotFoundException;
import com.sneha.hotel.repository.BookingRepository;
import com.sneha.hotel.repository.RoomRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final BookingRepository bookingRepository;

    // Constructor injection: dependencies are final and the class is easy to unit test
    public RoomService(RoomRepository roomRepository, BookingRepository bookingRepository) {
        this.roomRepository = roomRepository;
        this.bookingRepository = bookingRepository;
    }

    public List<Room> getAllRooms(RoomType type) {
        return type == null
                ? roomRepository.findByActiveTrue()
                : roomRepository.findByRoomTypeAndActiveTrue(type);
    }

    public Room getRoom(Long id) {
        return roomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Room", id));
    }

    public List<Room> findAvailable(LocalDate checkIn, LocalDate checkOut, int guests) {
        if (!checkOut.isAfter(checkIn)) {
            throw new BusinessException("Check-out date must be after check-in date");
        }
        return roomRepository.findAvailableRooms(checkIn, checkOut, guests);
    }

    @Transactional
    public Room addRoom(Room room) {
        if (roomRepository.existsByRoomNumber(room.getRoomNumber())) {
            throw new BusinessException("Room number " + room.getRoomNumber() + " already exists");
        }
        room.setId(null);
        room.setActive(true);
        return roomRepository.save(room);
    }

    @Transactional
    public Room updateRoom(Long id, Room updated) {
        Room room = getRoom(id);
        room.setRoomType(updated.getRoomType());
        room.setPricePerNight(updated.getPricePerNight());
        room.setCapacity(updated.getCapacity());
        return room; // dirty checking: Hibernate saves changes automatically at commit
    }

    /** Hard-delete a room with no history; otherwise deactivate it so past bookings stay valid. */
    @Transactional
    public void deleteRoom(Long id) {
        Room room = getRoom(id);
        if (bookingRepository.existsByRoomId(id)) {
            room.setActive(false);
        } else {
            roomRepository.delete(room);
        }
    }
}
