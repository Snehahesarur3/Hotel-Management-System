package com.hotel.service;

import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.dto.RoomDtos.RoomActivity;
import com.hotel.dto.RoomDtos.RoomInput;
import com.hotel.entity.Room;
import com.hotel.enums.RoomStatus;
import com.hotel.enums.RoomType;

import java.util.List;

/** /api/rooms: inventory, tariffs and status. */
public interface RoomService {

    PageResponse<Room> list(ListQuery query, Integer floor, RoomType type, RoomStatus status);

    Room get(String id);

    /** Distinct floors, ascending. */
    List<Integer> floors();

    RoomActivity activity(String id);

    Room create(RoomInput input);

    Room update(String id, RoomInput input);

    /** Manual status change: Available, Cleaning or Maintenance (Occupied/Reserved are workflow-driven). */
    Room updateStatus(String id, RoomStatus status);

    /** Only rooms without booking, housekeeping or restaurant history. */
    void delete(String id);
}
