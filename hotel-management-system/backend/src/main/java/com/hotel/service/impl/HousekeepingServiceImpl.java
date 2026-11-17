package com.hotel.service.impl;

import com.hotel.calculation.RoomStatusRules;
import com.hotel.calculation.Summaries;
import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.HousekeepingSummary;
import com.hotel.dto.OperationsDtos.HousekeepingTaskInput;
import com.hotel.dto.OperationsDtos.HousekeepingTaskView;
import com.hotel.dto.OperationsDtos.StaffWorkload;
import com.hotel.dto.PageResponse;
import com.hotel.entity.HousekeepingTask;
import com.hotel.entity.Room;
import com.hotel.entity.StaffMember;
import com.hotel.enums.Department;
import com.hotel.enums.EmploymentStatus;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.HousekeepingTaskType;
import com.hotel.enums.RoomStatus;
import com.hotel.enums.TaskPriority;
import com.hotel.exception.BusinessRuleException;
import com.hotel.exception.ResourceNotFoundException;
import com.hotel.exception.ValidationException;
import com.hotel.repository.BaseRepository;
import com.hotel.service.HousekeepingService;
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
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Housekeeping (frontend mock/services/housekeeping.ts):
 * <ul>
 *   <li>tasks go Pending -> In progress -> Completed (in progress can be paused back to Pending); completed is final;</li>
 *   <li>only active housekeeping or maintenance staff can be assigned;</li>
 *   <li>a room cannot have two open tasks of the same type on the same day;</li>
 *   <li>completing the last open checkout/deep clean of a room in Cleaning frees it (Available, or Reserved for today's arrival);</li>
 *   <li>only pending tasks can be deleted.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class HousekeepingServiceImpl implements HousekeepingService {

    /** Departments whose active staff can be assigned tasks. */
    public static final Set<Department> ASSIGNABLE_DEPARTMENTS = EnumSet.of(Department.HOUSEKEEPING, Department.MAINTENANCE);
    private static final Map<HousekeepingStatus, Integer> STATUS_ORDER = Map.of(
            HousekeepingStatus.IN_PROGRESS, 0, HousekeepingStatus.PENDING, 1, HousekeepingStatus.COMPLETED, 2);
    private static final Map<HousekeepingStatus, Set<HousekeepingStatus>> TRANSITIONS = Map.of(
            HousekeepingStatus.PENDING, EnumSet.of(HousekeepingStatus.IN_PROGRESS, HousekeepingStatus.COMPLETED),
            HousekeepingStatus.IN_PROGRESS, EnumSet.of(HousekeepingStatus.COMPLETED, HousekeepingStatus.PENDING),
            HousekeepingStatus.COMPLETED, EnumSet.noneOf(HousekeepingStatus.class));

    private final DataStore store;
    private final HotelClock clock;
    private final RoomStatusRules roomStatus;
    private final BaseRepository<HousekeepingTask> tasks;

    // ------------------------------------------------------------------ queries

    @Override
    public PageResponse<HousekeepingTaskView> list(ListQuery query, String date, HousekeepingStatus status, Integer floor, String staffId,
                                                   HousekeepingTaskType taskType, TaskPriority priority) {
        LocalDate day = InputValidator.optionalDate("date", date);
        return store.read(db -> ListQueries.apply(db.housekeepingTasks().stream().map(t -> toView(db, t)).toList(), query,
                ListQueries.Spec.<HousekeepingTaskView>of()
                        .search(t -> Arrays.asList(t.summary().id(), t.summary().roomNumber(), t.summary().assignee(), t.notes(),
                                Formats.label(t.summary().taskType())))
                        .filterIf(day, d -> t -> t.summary().scheduledDate().equals(d))
                        .filterIf(status, s -> t -> t.summary().status() == s)
                        .filterIf(floor, f -> t -> t.floor() == f)
                        .filterIf(staffId, s -> t -> s.equals(t.assignedStaffId()))
                        .filterIf(taskType, tt -> t -> t.summary().taskType() == tt)
                        .filterIf(priority, p -> t -> t.summary().priority() == p)
                        .sortBy("scheduledDate", t -> t.summary().scheduledDate())
                        .sortBy("roomNumber", t -> Summaries.roomNumberValue(t.summary().roomNumber()))
                        .sortBy("priority", t -> Summaries.PRIORITY_ORDER.get(t.summary().priority()))
                        .sortBy("status", t -> STATUS_ORDER.get(t.summary().status()))
                        .sortBy("taskType", t -> t.summary().taskType().ordinal())
                        .sortBy("assignee", t -> t.summary().assignee())
                        // Work queue order: by date, in progress, pending, done; urgent first; then by room.
                        .defaultOrder(Comparator.comparing((HousekeepingTaskView t) -> t.summary().scheduledDate())
                                .thenComparing(t -> STATUS_ORDER.get(t.summary().status()))
                                .thenComparing(t -> Summaries.PRIORITY_ORDER.get(t.summary().priority()))
                                .thenComparing(t -> Summaries.roomNumberValue(t.summary().roomNumber())))));
    }

    @Override
    public HousekeepingSummary summary(String date) {
        LocalDate day = date == null || date.isBlank() ? clock.today() : InputValidator.optionalDate("date", date);
        return store.read(db -> {
            List<HousekeepingTask> onDate = db.housekeepingTasks().stream().filter(t -> t.getScheduledDate().equals(day)).toList();
            return new HousekeepingSummary(
                    day,
                    count(onDate, HousekeepingStatus.PENDING),
                    count(onDate, HousekeepingStatus.IN_PROGRESS),
                    count(onDate, HousekeepingStatus.COMPLETED),
                    (int) db.rooms().stream().filter(r -> r.getStatus() == RoomStatus.CLEANING).count(),
                    assignableStaff(db).stream()
                            .map(s -> new StaffWorkload(s.getId(), s.getFullName(), s.getDepartment(),
                                    (int) onDate.stream().filter(t -> t.getAssignedStaffId().equals(s.getId()) && t.getStatus() != HousekeepingStatus.COMPLETED).count(),
                                    (int) onDate.stream().filter(t -> t.getAssignedStaffId().equals(s.getId()) && t.getStatus() == HousekeepingStatus.COMPLETED).count()))
                            .sorted(Comparator.comparingInt(StaffWorkload::open).thenComparing(StaffWorkload::fullName, TextMatching.NATURAL))
                            .toList());
        });
    }

    // ------------------------------------------------------------------ commands

    @Override
    public HousekeepingTaskView create(HousekeepingTaskInput input) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            ValidTask task = validate(db, input, clock.today(), null);
            HousekeepingTask saved = tasks.save(HousekeepingTask.builder()
                    .roomId(task.roomId())
                    .assignedStaffId(task.assignedStaffId())
                    .taskType(task.taskType())
                    .priority(task.priority())
                    .scheduledDate(task.scheduledDate())
                    .notes(task.notes())
                    .status(HousekeepingStatus.PENDING)
                    .build());
            return toView(store.snapshot(), saved);
        });
    }

    @Override
    public HousekeepingTaskView update(String id, HousekeepingTaskInput input) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            HousekeepingTask existing = find(db, id);
            if (existing.getStatus() == HousekeepingStatus.COMPLETED) {
                throw new BusinessRuleException(id + " is completed and can no longer be changed");
            }
            LocalDate today = clock.today();
            LocalDate earliest = existing.getScheduledDate().isBefore(today) ? existing.getScheduledDate() : today;
            ValidTask task = validate(db, input, earliest, id);
            HousekeepingTask saved = tasks.save(existing.toBuilder()
                    .roomId(task.roomId())
                    .assignedStaffId(task.assignedStaffId())
                    .taskType(task.taskType())
                    .priority(task.priority())
                    .scheduledDate(task.scheduledDate())
                    .notes(task.notes()) // null when cleared in the form
                    .build());
            // Moving a clean to another room may leave the old room with nothing to wait for.
            if (!existing.getRoomId().equals(saved.getRoomId())) {
                roomStatus.releaseRoomIfClean(existing.getRoomId(), today);
            }
            return toView(store.snapshot(), saved);
        });
    }

    @Override
    public HousekeepingTaskView updateStatus(String id, HousekeepingStatus status) {
        if (status == null) {
            throw ValidationException.of("status", "Unknown task status");
        }
        return store.write(() -> {
            HousekeepingTask task = find(store.snapshot(), id);
            if (!TRANSITIONS.get(task.getStatus()).contains(status)) {
                throw new BusinessRuleException("%s is %s and cannot become %s".formatted(id, Formats.lowerLabel(task.getStatus()),
                        Formats.lowerLabel(status)));
            }
            task.setStatus(status);
            if (status == HousekeepingStatus.COMPLETED) {
                task.setCompletedAt(clock.now());
            }
            HousekeepingTask saved = tasks.save(task);
            if (status == HousekeepingStatus.COMPLETED) {
                roomStatus.releaseRoomIfClean(saved.getRoomId(), clock.today());
            }
            return toView(store.snapshot(), saved);
        });
    }

    @Override
    public void delete(String id) {
        store.write(() -> {
            HousekeepingTask task = find(store.snapshot(), id);
            if (task.getStatus() != HousekeepingStatus.PENDING) {
                throw new BusinessRuleException("%s is %s; only pending tasks can be deleted".formatted(id, Formats.lowerLabel(task.getStatus())));
            }
            tasks.deleteById(id);
        });
    }

    // ------------------------------------------------------------------ rules

    record ValidTask(String roomId, String assignedStaffId, HousekeepingTaskType taskType, TaskPriority priority,
                     LocalDate scheduledDate, String notes) {
    }

    static List<StaffMember> assignableStaff(HotelData db) {
        return db.staff().stream()
                .filter(s -> s.getEmploymentStatus() == EmploymentStatus.ACTIVE && ASSIGNABLE_DEPARTMENTS.contains(s.getDepartment()))
                .toList();
    }

    static HousekeepingTaskView toView(HotelData db, HousekeepingTask task) {
        Room room = db.room(task.getRoomId());
        String notes = task.getNotes() == null || task.getNotes().isBlank() ? null : task.getNotes();
        return new HousekeepingTaskView(
                Summaries.toTaskSummary(db, task),
                task.getRoomId(),
                room == null ? 0 : room.getFloor(),
                room == null ? RoomStatus.AVAILABLE : room.getStatus(),
                task.getAssignedStaffId(),
                notes,
                task.getCompletedAt());
    }

    /** Input rules (frontend housekeepingTaskSchema) plus the business checks. */
    private static ValidTask validate(HotelData db, HousekeepingTaskInput input, LocalDate earliest, String exceptId) {
        InputValidator v = new InputValidator();
        v.text("roomId", input.roomId()).min(1, "Choose a room");
        v.text("assignedStaffId", input.assignedStaffId()).min(1, "Assign a staff member");
        v.required("taskType", input.taskType(), "Choose a task type");
        v.required("priority", input.priority(), "Choose a priority");
        LocalDate date = v.date("scheduledDate", input.scheduledDate(), "Choose the date", "Choose the date");
        if (date != null && date.isBefore(earliest)) {
            v.reject("scheduledDate", "Schedule on or after " + Formats.date(earliest));
        }
        v.text("notes", input.notes()).max(200, "At most 200 characters");
        v.throwIfInvalid();

        Room room = db.room(input.roomId());
        if (room == null) {
            throw ValidationException.of("roomId", "Choose an existing room");
        }
        if (assignableStaff(db).stream().noneMatch(s -> s.getId().equals(input.assignedStaffId()))) {
            throw ValidationException.of("assignedStaffId", "Assign an active housekeeping or maintenance staff member");
        }
        db.housekeepingTasks().stream()
                .filter(t -> !t.getId().equals(exceptId) && t.getRoomId().equals(input.roomId()) && t.getTaskType() == input.taskType()
                        && t.getScheduledDate().equals(date) && t.getStatus() != HousekeepingStatus.COMPLETED)
                .findFirst()
                .ifPresent(duplicate -> {
                    throw new BusinessRuleException("Room %s already has an open %s on %s (%s)".formatted(room.getRoomNumber(),
                            Formats.lowerLabel(input.taskType()), Formats.date(date), duplicate.getId()), "taskType");
                });
        String notes = input.notes() == null || input.notes().isBlank() ? null : input.notes();
        return new ValidTask(input.roomId(), input.assignedStaffId(), input.taskType(), input.priority(), date, notes);
    }

    private static HousekeepingTask find(HotelData db, String id) {
        return db.housekeepingTasks().stream()
                .filter(t -> t.getId().equals(id))
                .findFirst()
                .map(HousekeepingTask::copy)
                .orElseThrow(() -> new ResourceNotFoundException("Housekeeping task", id));
    }

    private static int count(List<HousekeepingTask> tasks, HousekeepingStatus status) {
        return (int) tasks.stream().filter(t -> t.getStatus() == status).count();
    }
}
