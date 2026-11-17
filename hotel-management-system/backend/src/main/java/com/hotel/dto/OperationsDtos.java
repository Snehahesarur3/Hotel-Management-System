package com.hotel.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.hotel.dto.DashboardDtos.HousekeepingTaskSummary;
import com.hotel.entity.InventoryItem;
import com.hotel.entity.MenuItem;
import com.hotel.entity.StaffMember;
import com.hotel.enums.Department;
import com.hotel.enums.EmploymentStatus;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.HousekeepingTaskType;
import com.hotel.enums.InventoryCategory;
import com.hotel.enums.MenuCategory;
import com.hotel.enums.OrderStatus;
import com.hotel.enums.RoomStatus;
import com.hotel.enums.StockStatus;
import com.hotel.enums.TaskPriority;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Housekeeping, restaurant, staff and inventory contracts
 * (frontend types/housekeeping.ts, restaurant.ts, staff.ts, inventory.ts).
 */
public final class OperationsDtos {

    private OperationsDtos() {
    }

    // ------------------------------------------------------------------ housekeeping

    /** Task row of GET /api/housekeeping/tasks. */
    public record HousekeepingTaskView(
            @JsonUnwrapped HousekeepingTaskSummary summary,
            String roomId,
            int floor,
            RoomStatus roomStatus,
            String assignedStaffId,
            String notes,
            LocalDateTime completedAt) {
    }

    /** Body of POST /api/housekeeping/tasks and PUT /api/housekeeping/tasks/{id}; scheduledDate is yyyy-MM-dd. */
    public record HousekeepingTaskInput(
            String roomId,
            String assignedStaffId,
            HousekeepingTaskType taskType,
            TaskPriority priority,
            String scheduledDate,
            String notes) {
    }

    public record TaskStatusUpdate(HousekeepingStatus status) {
    }

    /** @param open pending + in-progress tasks on the date */
    public record StaffWorkload(String staffId, String fullName, Department department, int open, int completed) {
    }

    /**
     * GET /api/housekeeping/summary?date=
     *
     * @param roomsToClean rooms in Cleaning status
     * @param staff        every assignable staff member, least busy first
     */
    public record HousekeepingSummary(
            LocalDate date,
            int pending,
            int inProgress,
            int completed,
            int roomsToClean,
            List<StaffWorkload> staff) {
    }

    // ------------------------------------------------------------------ restaurant

    /** Body of POST /api/restaurant/menu and PUT /api/restaurant/menu/{id}. */
    public record MenuItemInput(String name, MenuCategory category, BigDecimal price, Boolean isVegetarian, Boolean available) {
    }

    public record AvailabilityUpdate(Boolean available) {
    }

    /** @param timesOrdered non-cancelled orders that include the dish (such dishes cannot be deleted) */
    public record MenuItemView(@JsonUnwrapped MenuItem item, int timesOrdered) {
    }

    /** @param unitPrice price locked in when the order was placed */
    public record OrderLineView(String menuItemId, String name, int quantity, BigDecimal unitPrice, BigDecimal amount) {
    }

    /** @param locked the stay is checked out, so its invoice is final and the order can no longer change */
    public record OrderView(
            String id,
            String reservationId,
            String roomId,
            String roomNumber,
            String guestName,
            List<OrderLineView> items,
            int itemCount,
            BigDecimal subtotal,
            int gstPercent,
            BigDecimal gst,
            BigDecimal total,
            OrderStatus status,
            LocalDateTime orderedAt,
            boolean locked) {
    }

    /** Body of POST /api/restaurant/orders: charged to an in-house stay. */
    public record OrderInput(String reservationId, List<OrderLineInput> items) {
    }

    public record OrderLineInput(String menuItemId, Integer quantity) {
    }

    public record OrderStatusUpdate(OrderStatus status) {
    }

    /**
     * GET /api/restaurant/summary
     *
     * @param open       placed or preparing orders
     * @param salesToday non-cancelled orders placed today, before GST
     */
    public record RestaurantSummary(
            LocalDate date,
            int open,
            int placed,
            int preparing,
            int ordersToday,
            BigDecimal salesToday,
            int availableItems,
            int totalItems) {
    }

    // ------------------------------------------------------------------ staff

    /** Body of POST /api/staff and PUT /api/staff/{id}; joiningDate is yyyy-MM-dd. */
    public record StaffInput(
            String fullName,
            String email,
            String phone,
            Department department,
            String designation,
            String joiningDate,
            EmploymentStatus employmentStatus) {
    }

    /** @param openTasks pending or in-progress housekeeping tasks assigned to this person */
    public record StaffView(@JsonUnwrapped StaffMember member, int openTasks) {
    }

    public record DepartmentCount(Department department, int total, int active) {
    }

    public record StaffSummary(int total, int active, int onLeave, int inactive, List<DepartmentCount> byDepartment) {
    }

    // ------------------------------------------------------------------ inventory

    /**
     * Body of POST /api/inventory/items ({@code quantity} = opening stock) and PUT /api/inventory/items/{id}
     * ({@code quantity} ignored: stock only changes through movements).
     */
    public record InventoryItemInput(
            String name,
            InventoryCategory category,
            String unit,
            Integer quantity,
            Integer minStockLevel,
            BigDecimal unitCost,
            SupplierInput supplier) {
    }

    public record SupplierInput(String name, String contactPerson, String phone, String email) {
    }

    /**
     * @param stockValue quantity x unit cost
     * @param shortfall  units needed to get back to the reorder level (0 when above it)
     */
    public record InventoryItemView(@JsonUnwrapped InventoryItem item, StockStatus stockStatus, BigDecimal stockValue, int shortfall) {
    }

    /** @param unitCost optional new unit cost from the supplier invoice */
    public record StockInInput(Integer quantity, String reason, BigDecimal unitCost) {
    }

    public record StockOutInput(Integer quantity, String reason) {
    }

    /** @param reorder items that need reordering, most urgent first */
    public record InventorySummary(int totalItems, int lowCount, int outCount, BigDecimal stockValue, List<InventoryItemView> reorder) {
    }

    /** Supplier derived from item details (GET /api/inventory/suppliers). */
    public record SupplierView(
            String name,
            String contactPerson,
            String phone,
            String email,
            int itemCount,
            int lowCount,
            List<InventoryCategory> categories) {
    }
}
