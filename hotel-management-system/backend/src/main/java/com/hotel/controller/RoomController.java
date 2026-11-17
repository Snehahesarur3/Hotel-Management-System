package com.hotel.controller;

import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.dto.RoomDtos.RoomActivity;
import com.hotel.dto.RoomDtos.RoomInput;
import com.hotel.dto.RoomDtos.RoomStatusUpdate;
import com.hotel.entity.Room;
import com.hotel.enums.RoomStatus;
import com.hotel.enums.RoomType;
import com.hotel.service.RoomService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Rooms", description = "Room inventory, tariffs and status")
@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService rooms;

    @Operation(summary = "List rooms (search, filters, sort: roomNumber, floor, type, capacity, pricePerNight, status)")
    @GetMapping
    public PageResponse<Room> list(ListQuery query,
                                   @RequestParam(required = false) Integer floor,
                                   @RequestParam(required = false) RoomType type,
                                   @RequestParam(required = false) RoomStatus status) {
        return rooms.list(query, floor, type, status);
    }

    @Operation(summary = "Distinct floors, ascending")
    @GetMapping("/floors")
    public List<Integer> floors() {
        return rooms.floors();
    }

    @GetMapping("/{id}")
    public Room get(@PathVariable String id) {
        return rooms.get(id);
    }

    @Operation(summary = "Current stay, upcoming and past stays, housekeeping tasks")
    @GetMapping("/{id}/activity")
    public RoomActivity activity(@PathVariable String id) {
        return rooms.activity(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Room create(@RequestBody RoomInput input) {
        return rooms.create(input);
    }

    @PutMapping("/{id}")
    public Room update(@PathVariable String id, @RequestBody RoomInput input) {
        return rooms.update(id, input);
    }

    @Operation(summary = "Set Available, Cleaning or Maintenance (Occupied and Reserved are set by workflows)")
    @PatchMapping("/{id}/status")
    public Room updateStatus(@PathVariable String id, @RequestBody RoomStatusUpdate body) {
        return rooms.updateStatus(id, body.status());
    }

    @Operation(summary = "Delete a room without history")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        rooms.delete(id);
    }
}
