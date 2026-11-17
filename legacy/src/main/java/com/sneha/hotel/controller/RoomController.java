package com.sneha.hotel.controller;

import com.sneha.hotel.entity.Room;
import com.sneha.hotel.entity.RoomType;
import com.sneha.hotel.service.RoomService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    // GET /api/rooms            or  /api/rooms?type=DELUXE
    @GetMapping
    public List<Room> getAll(@RequestParam(required = false) RoomType type) {
        return roomService.getAllRooms(type);
    }

    // GET /api/rooms/3
    @GetMapping("/{id}")
    public Room getOne(@PathVariable Long id) {
        return roomService.getRoom(id);
    }

    // GET /api/rooms/available?checkIn=2026-12-01&checkOut=2026-12-03&guests=2
    @GetMapping("/available")
    public List<Room> available(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut,
            @RequestParam(defaultValue = "1") int guests) {
        return roomService.findAvailable(checkIn, checkOut, guests);
    }

    @PostMapping
    public ResponseEntity<Room> add(@Valid @RequestBody Room room) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roomService.addRoom(room));
    }

    @PutMapping("/{id}")
    public Room update(@PathVariable Long id, @Valid @RequestBody Room room) {
        return roomService.updateRoom(id, room);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        roomService.deleteRoom(id);
        return ResponseEntity.noContent().build();
    }
}
