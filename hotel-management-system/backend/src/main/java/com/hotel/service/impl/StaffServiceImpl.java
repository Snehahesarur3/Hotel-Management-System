package com.hotel.service.impl;

import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.DepartmentCount;
import com.hotel.dto.OperationsDtos.StaffInput;
import com.hotel.dto.OperationsDtos.StaffSummary;
import com.hotel.dto.OperationsDtos.StaffView;
import com.hotel.dto.PageResponse;
import com.hotel.entity.StaffMember;
import com.hotel.enums.Department;
import com.hotel.enums.EmploymentStatus;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.exception.BusinessRuleException;
import com.hotel.exception.ResourceNotFoundException;
import com.hotel.repository.BaseRepository;
import com.hotel.service.StaffService;
import com.hotel.store.DataStore;
import com.hotel.store.HotelClock;
import com.hotel.store.HotelData;
import com.hotel.util.Formats;
import com.hotel.util.InputValidator;
import com.hotel.util.ListQueries;
import com.hotel.util.TextMatching;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Staff (frontend mock/services/staff.ts):
 * <ul>
 *   <li>work emails are unique, ignoring case; new hires can be entered up to 90 days before they join;</li>
 *   <li>someone with open housekeeping tasks stays active and in an assignable department until the tasks are reassigned;</li>
 *   <li>staff with any task history cannot be deleted (set them Inactive instead).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class StaffServiceImpl implements StaffService {

    public static final int MAX_DAYS_BEFORE_JOINING = 90;

    private final DataStore store;
    private final HotelClock clock;
    private final BaseRepository<StaffMember> staff;

    @Override
    public PageResponse<StaffView> list(ListQuery query, Department department, EmploymentStatus status) {
        return store.read(db -> ListQueries.apply(db.staff().stream().map(s -> view(db, s)).toList(), query,
                ListQueries.Spec.<StaffView>of()
                        .search(s -> {
                            StaffMember m = s.member();
                            return List.of(m.getFullName(), m.getEmail(), m.getPhone(), m.getId(), m.getDesignation(), Formats.label(m.getDepartment()));
                        })
                        .filterIf(department, d -> s -> s.member().getDepartment() == d)
                        .filterIf(status, st -> s -> s.member().getEmploymentStatus() == st)
                        .sortBy("fullName", s -> s.member().getFullName())
                        .sortBy("department", s -> s.member().getDepartment().ordinal())
                        .sortBy("designation", s -> s.member().getDesignation())
                        .sortBy("joiningDate", s -> s.member().getJoiningDate())
                        .sortBy("employmentStatus", s -> s.member().getEmploymentStatus().ordinal())
                        .defaultOrder(Comparator.comparing(s -> s.member().getFullName(), TextMatching.NATURAL))));
    }

    @Override
    public StaffSummary summary() {
        return store.read(db -> {
            List<StaffMember> all = db.staff();
            return new StaffSummary(
                    all.size(),
                    count(all, EmploymentStatus.ACTIVE),
                    count(all, EmploymentStatus.ON_LEAVE),
                    count(all, EmploymentStatus.INACTIVE),
                    Arrays.stream(Department.values()).map(d -> {
                        List<StaffMember> inDept = all.stream().filter(m -> m.getDepartment() == d).toList();
                        return new DepartmentCount(d, inDept.size(), count(inDept, EmploymentStatus.ACTIVE));
                    }).toList());
        });
    }

    @Override
    public StaffView get(String id) {
        return store.read(db -> view(db, find(db, id)));
    }

    @Override
    public StaffView create(StaffInput raw) {
        return store.write(() -> {
            StaffMember member = validate(raw, clock.today());
            assertEmailAvailable(store.snapshot(), member.getEmail(), null);
            StaffMember saved = staff.save(member);
            return view(store.snapshot(), saved);
        });
    }

    @Override
    public StaffView update(String id, StaffInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            StaffMember existing = find(db, id);
            StaffMember member = validate(raw, clock.today());
            assertEmailAvailable(db, member.getEmail(), id);

            long open = openTasks(db, id);
            if (open > 0) {
                String tasks = Formats.plural(open, "open housekeeping task");
                if (member.getEmploymentStatus() != EmploymentStatus.ACTIVE) {
                    throw new BusinessRuleException("%s has %s. Reassign them before changing the status.".formatted(existing.getFullName(), tasks),
                            "employmentStatus");
                }
                if (!HousekeepingServiceImpl.ASSIGNABLE_DEPARTMENTS.contains(member.getDepartment())) {
                    throw new BusinessRuleException("%s has %s. Reassign them before moving to %s.".formatted(existing.getFullName(), tasks,
                            Formats.label(member.getDepartment())), "department");
                }
            }
            member.setId(id);
            StaffMember saved = staff.save(member);
            return view(store.snapshot(), saved);
        });
    }

    @Override
    public void delete(String id) {
        store.write(() -> {
            HotelData db = store.snapshot();
            StaffMember member = find(db, id);
            long tasks = db.housekeepingTasks().stream().filter(t -> t.getAssignedStaffId().equals(id)).count();
            if (tasks > 0) {
                throw new BusinessRuleException("%s has %s on record and cannot be deleted. Set them to Inactive instead."
                        .formatted(member.getFullName(), Formats.plural(tasks, "housekeeping task")));
            }
            staff.deleteById(id);
        });
    }

    // ------------------------------------------------------------------ rules

    private static long openTasks(HotelData db, String staffId) {
        return db.housekeepingTasks().stream()
                .filter(t -> t.getAssignedStaffId().equals(staffId) && t.getStatus() != HousekeepingStatus.COMPLETED)
                .count();
    }

    private static StaffView view(HotelData db, StaffMember member) {
        return new StaffView(member, (int) openTasks(db, member.getId()));
    }

    private static int count(List<StaffMember> members, EmploymentStatus status) {
        return (int) members.stream().filter(m -> m.getEmploymentStatus() == status).count();
    }

    private static StaffMember find(HotelData db, String id) {
        StaffMember member = db.staffMember(id);
        if (member == null) {
            throw new ResourceNotFoundException("Staff member", id);
        }
        return member.copy();
    }

    private static void assertEmailAvailable(HotelData db, String email, String exceptId) {
        db.staff().stream()
                .filter(s -> s.getEmail().equalsIgnoreCase(email) && !s.getId().equals(exceptId))
                .findFirst()
                .ifPresent(clash -> {
                    throw new BusinessRuleException("This email belongs to " + clash.getFullName(), "email");
                });
    }

    /** Same rules and messages as the frontend's staffInputSchema; returns the normalised member (without id). */
    static StaffMember validate(StaffInput input, LocalDate today) {
        LocalDate latest = today.plusDays(MAX_DAYS_BEFORE_JOINING);
        InputValidator v = new InputValidator();
        String email = input.email() == null ? "" : input.email().toLowerCase(Locale.ROOT);
        v.text("fullName", input.fullName()).min(2, "Enter the full name").max(80, "At most 80 characters")
                .matches(InputValidator.NAME, "Use letters, spaces, apostrophes, dots or hyphens");
        v.text("email", email).matches(InputValidator.EMAIL, "Enter a valid email address").max(120, "Enter a valid email address");
        v.text("phone", input.phone()).matches(InputValidator.PHONE, "Enter a valid phone number, e.g. +91 98450 12345")
                .satisfies(p -> p.replaceAll("\\D", "").length() >= 7, "Enter a valid phone number, e.g. +91 98450 12345");
        v.required("department", input.department(), "Choose a department");
        v.text("designation", input.designation()).min(2, "Enter the job title").max(60, "At most 60 characters");
        LocalDate joining = v.date("joiningDate", input.joiningDate(), "Choose the joining date", "Choose the joining date");
        if (joining != null && joining.isAfter(latest)) {
            v.reject("joiningDate", "Joining date can be at most %d days ahead (%s)".formatted(MAX_DAYS_BEFORE_JOINING, Formats.date(latest)));
        }
        v.required("employmentStatus", input.employmentStatus(), "Choose a status");
        v.throwIfInvalid();
        return StaffMember.builder()
                .fullName(input.fullName())
                .email(email)
                .phone(input.phone())
                .department(input.department())
                .designation(input.designation())
                .joiningDate(joining)
                .employmentStatus(input.employmentStatus())
                .build();
    }
}
