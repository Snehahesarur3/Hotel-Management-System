package com.hotel.controller;

import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.StaffInput;
import com.hotel.dto.OperationsDtos.StaffSummary;
import com.hotel.dto.OperationsDtos.StaffView;
import com.hotel.dto.PageResponse;
import com.hotel.enums.Department;
import com.hotel.enums.EmploymentStatus;
import com.hotel.service.StaffService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Staff", description = "Employees, departments and employment status")
@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffService staff;

    @Operation(summary = "Staff (sort: fullName, department, designation, joiningDate, employmentStatus)")
    @GetMapping
    public PageResponse<StaffView> list(ListQuery query,
                                        @RequestParam(required = false) Department department,
                                        @RequestParam(required = false) EmploymentStatus status) {
        return staff.list(query, department, status);
    }

    @GetMapping("/summary")
    public StaffSummary summary() {
        return staff.summary();
    }

    @GetMapping("/{id}")
    public StaffView get(@PathVariable String id) {
        return staff.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StaffView create(@RequestBody StaffInput input) {
        return staff.create(input);
    }

    @PutMapping("/{id}")
    public StaffView update(@PathVariable String id, @RequestBody StaffInput input) {
        return staff.update(id, input);
    }

    @Operation(summary = "Delete staff without task history")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        staff.delete(id);
    }
}
