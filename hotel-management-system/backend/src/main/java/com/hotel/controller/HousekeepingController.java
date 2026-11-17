package com.hotel.controller;

import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.HousekeepingSummary;
import com.hotel.dto.OperationsDtos.HousekeepingTaskInput;
import com.hotel.dto.OperationsDtos.HousekeepingTaskView;
import com.hotel.dto.OperationsDtos.TaskStatusUpdate;
import com.hotel.dto.PageResponse;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.HousekeepingTaskType;
import com.hotel.enums.TaskPriority;
import com.hotel.service.HousekeepingService;
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

@Tag(name = "Housekeeping", description = "Cleaning schedule and task tracking")
@RestController
@RequestMapping("/api/housekeeping")
@RequiredArgsConstructor
public class HousekeepingController {

    private final HousekeepingService housekeeping;

    @Operation(summary = "Tasks (sort: scheduledDate, roomNumber, priority, status, taskType, assignee)")
    @GetMapping("/tasks")
    public PageResponse<HousekeepingTaskView> list(ListQuery query,
                                                   @RequestParam(required = false) String date,
                                                   @RequestParam(required = false) HousekeepingStatus status,
                                                   @RequestParam(required = false) Integer floor,
                                                   @RequestParam(required = false) String staffId,
                                                   @RequestParam(required = false) HousekeepingTaskType taskType,
                                                   @RequestParam(required = false) TaskPriority priority) {
        return housekeeping.list(query, date, status, floor, staffId, taskType, priority);
    }

    @Operation(summary = "Counts and staff workload for a day (default today)")
    @GetMapping("/summary")
    public HousekeepingSummary summary(@RequestParam(required = false) String date) {
        return housekeeping.summary(date);
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public HousekeepingTaskView create(@RequestBody HousekeepingTaskInput input) {
        return housekeeping.create(input);
    }

    @PutMapping("/tasks/{id}")
    public HousekeepingTaskView update(@PathVariable String id, @RequestBody HousekeepingTaskInput input) {
        return housekeeping.update(id, input);
    }

    @Operation(summary = "Pending -> In progress -> Completed (in progress can go back to Pending)")
    @PatchMapping("/tasks/{id}/status")
    public HousekeepingTaskView updateStatus(@PathVariable String id, @RequestBody TaskStatusUpdate body) {
        return housekeeping.updateStatus(id, body.status());
    }

    @DeleteMapping("/tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        housekeeping.delete(id);
    }
}
