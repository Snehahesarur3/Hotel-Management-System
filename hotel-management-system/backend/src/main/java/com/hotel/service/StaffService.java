package com.hotel.service;

import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.StaffInput;
import com.hotel.dto.OperationsDtos.StaffSummary;
import com.hotel.dto.OperationsDtos.StaffView;
import com.hotel.dto.PageResponse;
import com.hotel.enums.Department;
import com.hotel.enums.EmploymentStatus;

/** /api/staff: employees, departments and employment status. */
public interface StaffService {

    PageResponse<StaffView> list(ListQuery query, Department department, EmploymentStatus status);

    StaffSummary summary();

    StaffView get(String id);

    StaffView create(StaffInput input);

    StaffView update(String id, StaffInput input);

    /** Only staff without housekeeping task history. */
    void delete(String id);
}
