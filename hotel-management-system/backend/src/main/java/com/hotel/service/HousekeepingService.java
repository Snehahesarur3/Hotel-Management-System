package com.hotel.service;

import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.HousekeepingSummary;
import com.hotel.dto.OperationsDtos.HousekeepingTaskInput;
import com.hotel.dto.OperationsDtos.HousekeepingTaskView;
import com.hotel.dto.PageResponse;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.HousekeepingTaskType;
import com.hotel.enums.TaskPriority;

/** /api/housekeeping: cleaning schedule and task tracking. */
public interface HousekeepingService {

    PageResponse<HousekeepingTaskView> list(ListQuery query, String date, HousekeepingStatus status, Integer floor, String staffId,
                                            HousekeepingTaskType taskType, TaskPriority priority);

    /** Counts and staff workload for a day (yyyy-MM-dd, default today). */
    HousekeepingSummary summary(String date);

    HousekeepingTaskView create(HousekeepingTaskInput input);

    /** Not for completed tasks. */
    HousekeepingTaskView update(String id, HousekeepingTaskInput input);

    HousekeepingTaskView updateStatus(String id, HousekeepingStatus status);

    /** Pending tasks only. */
    void delete(String id);
}
