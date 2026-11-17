package com.hotel.service;

import com.hotel.dto.FrontDeskDtos.CheckOutInput;
import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.HousekeepingTaskInput;
import com.hotel.dto.OperationsDtos.InventoryItemInput;
import com.hotel.dto.OperationsDtos.MenuItemInput;
import com.hotel.dto.OperationsDtos.OrderInput;
import com.hotel.dto.OperationsDtos.OrderLineInput;
import com.hotel.dto.OperationsDtos.OrderView;
import com.hotel.dto.OperationsDtos.StaffInput;
import com.hotel.dto.OperationsDtos.StockInInput;
import com.hotel.dto.OperationsDtos.StockOutInput;
import com.hotel.dto.OperationsDtos.SupplierInput;
import com.hotel.entity.StockMovement;
import com.hotel.enums.Department;
import com.hotel.enums.EmploymentStatus;
import com.hotel.enums.HousekeepingStatus;
import com.hotel.enums.HousekeepingTaskType;
import com.hotel.enums.InventoryCategory;
import com.hotel.enums.MenuCategory;
import com.hotel.enums.OrderStatus;
import com.hotel.enums.PaymentMethod;
import com.hotel.enums.RoomStatus;
import com.hotel.enums.StockMovementType;
import com.hotel.enums.StockStatus;
import com.hotel.enums.TaskPriority;
import com.hotel.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static com.hotel.support.ApiAssertions.invalid;
import static com.hotel.support.ApiAssertions.rejected;
import static org.assertj.core.api.Assertions.assertThat;

/** Housekeeping, restaurant, staff and inventory rules. */
class OperationsServiceTest extends IntegrationTest {

    @Autowired
    private HousekeepingService housekeeping;
    @Autowired
    private RoomService rooms;
    @Autowired
    private RestaurantService restaurant;
    @Autowired
    private FrontDeskService frontDesk;
    @Autowired
    private StaffService staff;
    @Autowired
    private InventoryService inventory;

    // ------------------------------------------------------------------ housekeeping

    @Test
    void finishingTheLastCleanFreesTheRoom() {
        assertThat(rooms.get("RM-107").getStatus()).isEqualTo(RoomStatus.CLEANING);
        var done = housekeeping.updateStatus("HK-0001", HousekeepingStatus.COMPLETED);
        assertThat(done.completedAt()).isNotNull();
        assertThat(rooms.get("RM-107").getStatus()).isEqualTo(RoomStatus.AVAILABLE);

        rejected(() -> housekeeping.updateStatus("HK-0001", HousekeepingStatus.PENDING), 409,
                "HK-0001 is completed and cannot become pending");
        rejected(() -> housekeeping.delete("HK-0001"), 409, "HK-0001 is completed; only pending tasks can be deleted");
    }

    @Test
    void assignsOnlyActiveHousekeepingStaffAndRefusesDuplicates() {
        var task = new HousekeepingTaskInput("RM-101", "STF-0006", HousekeepingTaskType.DEEP_CLEAN, TaskPriority.HIGH, TODAY.toString(), " ");
        var created = housekeeping.create(task);
        assertThat(created.summary().status()).isEqualTo(HousekeepingStatus.PENDING);
        assertThat(created.notes()).isNull();

        rejected(() -> housekeeping.create(task), 409, "Room 101 already has an open deep clean on 11 Nov 2026 (%s)".formatted(created.summary().id()));
        invalid(() -> housekeeping.create(new HousekeepingTaskInput("RM-101", "STF-0003", HousekeepingTaskType.INSPECTION, TaskPriority.LOW,
                TODAY.toString(), null)), Map.of("assignedStaffId", "Assign an active housekeeping or maintenance staff member"));
        invalid(() -> housekeeping.create(new HousekeepingTaskInput("RM-101", "STF-0006", HousekeepingTaskType.INSPECTION, null,
                TODAY.minusDays(1).toString(), null)), Map.of("priority", "Choose a priority", "scheduledDate", "Schedule on or after 11 Nov 2026"));

        var summary = housekeeping.summary(null);
        assertThat(summary.date()).isEqualTo(TODAY);
        assertThat(summary.roomsToClean()).isEqualTo(2);
        assertThat(summary.staff()).allMatch(s -> s.department() == Department.HOUSEKEEPING || s.department() == Department.MAINTENANCE);
        housekeeping.delete(created.summary().id());
    }

    // ------------------------------------------------------------------ restaurant

    @Test
    void ordersAreChargedToInHouseStaysAtTheCurrentPriceAndLockedAfterCheckOut() {
        var dish = restaurant.menu(new ListQuery(0, 1, null, null), null, null, true).content().getFirst().item();
        OrderView order = restaurant.createOrder(new OrderInput("BK-0015", List.of(new OrderLineInput(dish.getId(), 2))));
        assertThat(order.status()).isEqualTo(OrderStatus.PLACED);
        assertThat(order.subtotal()).isEqualByComparingTo(dish.getPrice().multiply(BigDecimal.TWO));
        assertThat(order.gstPercent()).isEqualTo(5);

        // A price change later does not touch the order.
        restaurant.updateMenuItem(dish.getId(), new MenuItemInput(dish.getName(), dish.getCategory(), dish.getPrice().add(BigDecimal.TEN), dish.isVegetarian(), true));
        assertThat(restaurant.orders(new ListQuery(0, 5, order.id(), null), null, null).content().getFirst().subtotal()).isEqualByComparingTo(order.subtotal());

        restaurant.updateOrderStatus(order.id(), OrderStatus.PREPARING);
        rejected(() -> restaurant.updateOrderStatus(order.id(), OrderStatus.PLACED), 409, order.id() + " is preparing and cannot become placed");
        frontDesk.checkOut("BK-0015", new CheckOutInput(PaymentMethod.CASH));
        rejected(() -> restaurant.updateOrderStatus(order.id(), OrderStatus.SERVED), 409,
                order.id() + " belongs to INV-0015, which is final; the order can no longer change");

        rejected(() -> restaurant.createOrder(new OrderInput("BK-0030", List.of(new OrderLineInput(dish.getId(), 1)))), 409,
                "BK-0030 is confirmed; orders can only be charged to in-house guests");
        invalid(() -> restaurant.createOrder(new OrderInput("BK-0021", List.of())), Map.of("items", "Add at least one dish"));
    }

    @Test
    void menuNamesAreUniqueAndOrderedDishesCannotBeDeleted() {
        var created = restaurant.createMenuItem(new MenuItemInput("Goan Fish Curry Special", MenuCategory.MAIN_COURSE, new BigDecimal("650"), false, true));
        assertThat(created.item().getId()).isEqualTo("MNU-0021");
        rejected(() -> restaurant.createMenuItem(new MenuItemInput("goan fish curry SPECIAL", MenuCategory.MAIN_COURSE, new BigDecimal("650"), false, true)), 409);
        invalid(() -> restaurant.createMenuItem(new MenuItemInput("X", null, new BigDecimal("5"), null, true)), Map.of(
                "name", "Enter the dish name", "category", "Choose a category", "price", "Minimum ₹10", "isVegetarian", "Choose vegetarian or not"));
        restaurant.deleteMenuItem(created.item().getId());

        String ordered = restaurant.menu(new ListQuery(0, 1, null, "timesOrdered,desc"), null, null, null).content().getFirst().item().getId();
        rejected(() -> restaurant.deleteMenuItem(ordered), 409);
        assertThat(restaurant.setAvailability(ordered, false).item().isAvailable()).isFalse();
    }

    // ------------------------------------------------------------------ staff

    @Test
    void staffWithOpenTasksStayOnDutyAndStaffWithHistoryAreKept() {
        var sunil = staff.get("STF-0007").member();
        StaffInput onLeave = new StaffInput(sunil.getFullName(), sunil.getEmail(), sunil.getPhone(), sunil.getDepartment(), sunil.getDesignation(),
                sunil.getJoiningDate().toString(), EmploymentStatus.ON_LEAVE);
        var error = rejected(() -> staff.update("STF-0007", onLeave), 409);
        assertThat(error.getMessage()).matches("Sunil Parab has \\d+ open housekeeping tasks\\. Reassign them before changing the status\\.");
        rejected(() -> staff.delete("STF-0007"), 409);
        staff.delete("STF-0015"); // Baldev Singh, security, no task history

        invalid(() -> staff.create(new StaffInput("Neha Kamath", "neha@aureliabay.example", "+91 90000 51111", Department.RECEPTION,
                "Front Office Associate", TODAY.plusDays(91).toString(), EmploymentStatus.ACTIVE)),
                Map.of("joiningDate", "Joining date can be at most 90 days ahead (9 Feb 2027)"));
        rejected(() -> staff.create(new StaffInput("Neha Kamath", "PRIYA.MENON@aureliabay.example", "+91 90000 51111", Department.RECEPTION,
                "Front Office Associate", TODAY.toString(), EmploymentStatus.ACTIVE)), 409, "This email belongs to Priya Menon");
        assertThat(staff.summary().total()).isEqualTo(14);
    }

    // ------------------------------------------------------------------ inventory

    @Test
    void stockOnlyChangesThroughRecordedMovements() {
        var item = inventory.create(new InventoryItemInput("Pool Towel (Blue)", InventoryCategory.LINEN, "pcs", 50, 40, new BigDecimal("380"),
                new SupplierInput("Coastal Linen Co.", "Rita Fernandes", "+91 90000 70011", "ORDERS@coastallinen.example")));
        String id = item.item().getId();
        assertThat(item.stockStatus()).isEqualTo(StockStatus.IN_STOCK);
        assertThat(item.item().getSupplier().email()).isEqualTo("orders@coastallinen.example");

        rejected(() -> inventory.stockOut(id, new StockOutInput(51, "Issued to housekeeping")), 409, "Only 50 pcs in stock");
        assertThat(inventory.stockOut(id, new StockOutInput(15, "Issued to housekeeping")).stockStatus()).isEqualTo(StockStatus.LOW);
        assertThat(inventory.stockIn(id, new StockInInput(30, "Purchase order received", new BigDecimal("400"))).item().getUnitCost())
                .isEqualByComparingTo("400");
        // Editing never changes the quantity.
        assertThat(inventory.update(id, new InventoryItemInput("Pool Towel (Blue)", InventoryCategory.LINEN, "pcs", 9999, 40, new BigDecimal("400"),
                new SupplierInput("Coastal Linen Co.", "Rita Fernandes", "+91 90000 70011", "orders@coastallinen.example"))).item().getQuantity())
                .isEqualTo(65);

        List<StockMovement> history = inventory.movements(id);
        assertThat(history).extracting(StockMovement::getType)
                .containsExactly(StockMovementType.STOCK_IN, StockMovementType.STOCK_OUT, StockMovementType.STOCK_IN);
        assertThat(history.getFirst().getBalanceAfter()).isEqualTo(65);
        assertThat(history.getLast().getReason()).isEqualTo("Opening stock");
        rejected(() -> inventory.delete(id), 409);

        invalid(() -> inventory.stockIn(id, new StockInInput(0, "x", null)),
                Map.of("quantity", "The quantity must be at least 1", "reason", "Give a reason"));
        assertThat(inventory.list(ListQuery.all(), null, "LOW", null).content()).allMatch(i -> i.stockStatus() != StockStatus.IN_STOCK);
        assertThat(inventory.suppliers()).extracting("name").contains("Coastal Linen Co.");
    }
}
