package com.hotel.entity;

import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.HousekeepingTaskType;
import com.hotel.enums.TaskPriority;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** A cleaning, service or inspection task for a room. */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class HousekeepingTask implements Identifiable {

    private String id;
    private String roomId;
    private String assignedStaffId;
    private HousekeepingTaskType taskType;
    private TaskPriority priority;
    private HousekeepingStatus status;
    private LocalDate scheduledDate;
    private LocalDateTime completedAt;
    private String notes;

    /** Detached copy (the repository never hands out its stored instance). */
    public HousekeepingTask copy() {
        return toBuilder().build();
    }
}
