package com.hotel.entity;

import com.hotel.enums.Department;
import com.hotel.enums.EmploymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/** An employee. */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class StaffMember implements Identifiable {

    private String id;
    private String fullName;
    private String email;
    private String phone;
    private Department department;
    private String designation;
    private LocalDate joiningDate;
    private EmploymentStatus employmentStatus;

    /** Detached copy (the repository never hands out its stored instance). */
    public StaffMember copy() {
        return toBuilder().build();
    }
}
