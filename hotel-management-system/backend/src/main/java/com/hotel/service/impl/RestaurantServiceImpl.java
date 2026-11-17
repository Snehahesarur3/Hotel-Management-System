package com.hotel.service.impl;

import com.hotel.calculation.BillCalculator;
import com.hotel.calculation.Summaries;
import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.MenuItemInput;
import com.hotel.dto.OperationsDtos.MenuItemView;
import com.hotel.dto.OperationsDtos.OrderInput;
import com.hotel.dto.OperationsDtos.OrderLineInput;
import com.hotel.dto.OperationsDtos.OrderLineView;
import com.hotel.dto.OperationsDtos.OrderView;
import com.hotel.dto.OperationsDtos.RestaurantSummary;
import com.hotel.dto.PageResponse;
import com.hotel.entity.MenuItem;
import com.hotel.entity.Reservation;
import com.hotel.entity.RestaurantOrder;
import com.hotel.entity.RestaurantOrder.OrderLine;
import com.hotel.entity.Room;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.MenuCategory;
import com.hotel.enums.OrderStatus;
import com.hotel.exception.BusinessRuleException;
import com.hotel.exception.ResourceNotFoundException;
import com.hotel.exception.ValidationException;
import com.hotel.repository.BaseRepository;
import com.hotel.service.RestaurantService;
import com.hotel.store.DataStore;
import com.hotel.store.HotelClock;
import com.hotel.store.HotelData;
import com.hotel.util.Formats;
import com.hotel.util.InputValidator;
import com.hotel.util.ListQueries;
import com.hotel.util.MoneyUtils;
import com.hotel.util.TextMatching;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.hotel.dto.BillingDtos.invoiceNumberFor;

/**
 * Restaurant (frontend mock/services/restaurant.ts).
 * Menu: names are unique (ignoring case); dishes that have been ordered cannot be deleted (mark them unavailable).
 * Orders: charged to an in-house (checked-in) stay with food GST; only available dishes, at the menu price at that
 * moment; placed -> preparing -> served / delivered, and placed or preparing orders can be cancelled;
 * once the stay is checked out its invoice is final, so its orders are locked.
 */
@Service
@RequiredArgsConstructor
public class RestaurantServiceImpl implements RestaurantService {

    public static final int MAX_ORDER_QUANTITY = 20;
    private static final Map<OrderStatus, Set<OrderStatus>> TRANSITIONS = Map.of(
            OrderStatus.PLACED, EnumSet.of(OrderStatus.PREPARING, OrderStatus.CANCELLED),
            OrderStatus.PREPARING, EnumSet.of(OrderStatus.SERVED, OrderStatus.DELIVERED, OrderStatus.CANCELLED),
            OrderStatus.SERVED, EnumSet.noneOf(OrderStatus.class),
            OrderStatus.DELIVERED, EnumSet.noneOf(OrderStatus.class),
            OrderStatus.CANCELLED, EnumSet.noneOf(OrderStatus.class));
    private static final Comparator<MenuItem> MENU_ORDER = Comparator.comparing((MenuItem m) -> m.getCategory().ordinal())
            .thenComparing(MenuItem::getName, TextMatching.NATURAL);

    private final DataStore store;
    private final HotelClock clock;
    private final BaseRepository<MenuItem> menuItems;
    private final BaseRepository<RestaurantOrder> orders;

    // ------------------------------------------------------------------ menu

    @Override
    public PageResponse<MenuItemView> menu(ListQuery query, MenuCategory category, Boolean vegetarian, Boolean available) {
        return store.read(db -> ListQueries.apply(db.menuItems().stream().map(m -> view(db, m)).toList(), query,
                ListQueries.Spec.<MenuItemView>of()
                        .search(m -> List.of(m.item().getName(), m.item().getId(), Formats.label(m.item().getCategory())))
                        .filterIf(category, c -> m -> m.item().getCategory() == c)
                        .filterIf(vegetarian, veg -> m -> m.item().isVegetarian() == veg)
                        .filterIf(available, a -> m -> m.item().isAvailable() == a)
                        .sortBy("name", m -> m.item().getName())
                        .sortBy("category", m -> m.item().getCategory().ordinal())
                        .sortBy("price", m -> m.item().getPrice())
                        .sortBy("timesOrdered", MenuItemView::timesOrdered)
                        .defaultOrder(Comparator.comparing(MenuItemView::item, MENU_ORDER))));
    }

    @Override
    public MenuItemView createMenuItem(MenuItemInput raw) {
        return store.write(() -> {
            MenuItemInput input = validateMenuItem(raw);
            assertNameAvailable(store.snapshot(), input.name(), null);
            MenuItem saved = menuItems.save(toItem(input));
            return view(store.snapshot(), saved);
        });
    }

    @Override
    public MenuItemView updateMenuItem(String id, MenuItemInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            findItem(db, id);
            MenuItemInput input = validateMenuItem(raw);
            assertNameAvailable(db, input.name(), id);
            MenuItem item = toItem(input);
            item.setId(id);
            MenuItem saved = menuItems.save(item);
            return view(store.snapshot(), saved);
        });
    }

    @Override
    public MenuItemView setAvailability(String id, Boolean available) {
        if (available == null) {
            throw ValidationException.of("available", "Send available: true or false");
        }
        return store.write(() -> {
            MenuItem item = findItem(store.snapshot(), id);
            item.setAvailable(available);
            MenuItem saved = menuItems.save(item);
            return view(store.snapshot(), saved);
        });
    }

    @Override
    public void deleteMenuItem(String id) {
        store.write(() -> {
            HotelData db = store.snapshot();
            MenuItem item = findItem(db, id);
            long count = db.restaurantOrders().stream().filter(o -> o.getItems().stream().anyMatch(l -> l.menuItemId().equals(id))).count();
            if (count > 0) {
                throw new BusinessRuleException("%s appears on %s and cannot be deleted. Mark it unavailable to take it off the menu."
                        .formatted(item.getName(), Formats.plural(count, "order")));
            }
            menuItems.deleteById(id);
        });
    }

    // ------------------------------------------------------------------ orders

    @Override
    public PageResponse<OrderView> orders(ListQuery query, OrderStatus status, String date) {
        LocalDate day = InputValidator.optionalDate("date", date);
        return store.read(db -> ListQueries.apply(db.restaurantOrders().stream().map(o -> toOrderView(db, o)).toList(), query,
                ListQueries.Spec.<OrderView>of()
                        .search(o -> {
                            List<Object> fields = new ArrayList<>(List.of(o.id(), o.reservationId(), o.guestName(), o.roomNumber()));
                            o.items().forEach(i -> fields.add(i.name()));
                            return fields;
                        })
                        .filterIf(status, s -> o -> o.status() == s)
                        .filterIf(day, d -> o -> o.orderedAt().toLocalDate().equals(d))
                        .sortBy("orderedAt", OrderView::orderedAt)
                        .sortBy("total", OrderView::total)
                        .sortBy("status", o -> o.status().ordinal())
                        .sortBy("roomNumber", o -> Summaries.roomNumberValue(o.roomNumber()))
                        .defaultOrder(Comparator.comparing(OrderView::orderedAt).thenComparing(OrderView::id).reversed())));
    }

    @Override
    public OrderView createOrder(OrderInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            validateOrder(raw);
            Reservation reservation = db.reservation(raw.reservationId());
            if (reservation == null) {
                throw ValidationException.of("reservationId", "Choose an existing booking");
            }
            if (reservation.getStatus() != BookingStatus.CHECKED_IN) {
                throw new BusinessRuleException("%s is %s; orders can only be charged to in-house guests".formatted(reservation.getId(),
                        Formats.lowerLabel(reservation.getStatus())), "reservationId");
            }
            List<OrderLine> lines = raw.items().stream().map(line -> {
                MenuItem item = db.menuItem(line.menuItemId());
                if (item == null) {
                    throw ValidationException.of("items", "Dish '%s' is not on the menu".formatted(line.menuItemId()));
                }
                if (!item.isAvailable()) {
                    throw new BusinessRuleException(item.getName() + " is not available right now", "items");
                }
                return new OrderLine(item.getId(), line.quantity(), item.getPrice());
            }).toList();
            RestaurantOrder saved = orders.save(RestaurantOrder.builder()
                    .reservationId(reservation.getId())
                    .roomId(reservation.getRoomId())
                    .items(new ArrayList<>(lines))
                    .status(OrderStatus.PLACED)
                    .orderedAt(clock.now())
                    .build());
            return toOrderView(store.snapshot(), saved);
        });
    }

    @Override
    public OrderView updateOrderStatus(String id, OrderStatus status) {
        if (status == null) {
            throw ValidationException.of("status", "Unknown order status");
        }
        return store.write(() -> {
            HotelData db = store.snapshot();
            RestaurantOrder order = db.restaurantOrders().stream().filter(o -> o.getId().equals(id)).findFirst()
                    .map(RestaurantOrder::copy)
                    .orElseThrow(() -> new ResourceNotFoundException("Order", id));
            Set<OrderStatus> allowed = TRANSITIONS.get(order.getStatus());
            if (toOrderView(db, order).locked() && !allowed.isEmpty()) {
                throw new BusinessRuleException("%s belongs to %s, which is final; the order can no longer change"
                        .formatted(id, invoiceNumberFor(order.getReservationId())));
            }
            if (!allowed.contains(status)) {
                throw new BusinessRuleException("%s is %s and cannot become %s".formatted(id, Formats.lowerLabel(order.getStatus()),
                        Formats.lowerLabel(status)));
            }
            order.setStatus(status);
            RestaurantOrder saved = orders.save(order);
            return toOrderView(store.snapshot(), saved);
        });
    }

    @Override
    public RestaurantSummary summary() {
        return store.read(db -> {
            LocalDate today = clock.today();
            List<RestaurantOrder> todays = db.restaurantOrders().stream()
                    .filter(o -> o.getOrderedAt().toLocalDate().equals(today) && o.getStatus() != OrderStatus.CANCELLED)
                    .toList();
            int placed = countOrders(db, OrderStatus.PLACED);
            int preparing = countOrders(db, OrderStatus.PREPARING);
            return new RestaurantSummary(today, placed + preparing, placed, preparing, todays.size(),
                    MoneyUtils.sum(todays.stream().map(BillCalculator::orderAmount)),
                    (int) db.menuItems().stream().filter(MenuItem::isAvailable).count(),
                    db.menuItems().size());
        });
    }

    // ------------------------------------------------------------------ helpers

    private static int countOrders(HotelData db, OrderStatus status) {
        return (int) db.restaurantOrders().stream().filter(o -> o.getStatus() == status).count();
    }

    private static int timesOrdered(HotelData db, String itemId) {
        return (int) db.restaurantOrders().stream()
                .filter(o -> o.getStatus() != OrderStatus.CANCELLED && o.getItems().stream().anyMatch(l -> l.menuItemId().equals(itemId)))
                .count();
    }

    private static MenuItemView view(HotelData db, MenuItem item) {
        return new MenuItemView(item, timesOrdered(db, item.getId()));
    }

    static OrderView toOrderView(HotelData db, RestaurantOrder order) {
        Reservation reservation = db.reservation(order.getReservationId());
        Room room = db.room(order.getRoomId());
        BigDecimal subtotal = BillCalculator.orderAmount(order);
        int gstPercent = db.settings().taxes().foodGstPercent();
        BigDecimal gst = MoneyUtils.percentOf(subtotal, BigDecimal.valueOf(gstPercent));
        List<OrderLineView> lines = order.getItems().stream().map(l -> {
            MenuItem item = db.menuItem(l.menuItemId());
            return new OrderLineView(l.menuItemId(), item == null ? "Removed item" : item.getName(), l.quantity(),
                    MoneyUtils.scale(l.unitPrice()), MoneyUtils.multiply(l.unitPrice(), l.quantity()));
        }).toList();
        return new OrderView(
                order.getId(),
                order.getReservationId(),
                order.getRoomId(),
                room == null ? Summaries.NO_ROOM : room.getRoomNumber(),
                reservation == null ? Summaries.UNKNOWN_GUEST : Summaries.guestName(db, reservation.getGuestId()),
                lines,
                order.getItems().stream().mapToInt(OrderLine::quantity).sum(),
                subtotal,
                gstPercent,
                gst,
                MoneyUtils.scale(subtotal.add(gst)),
                order.getStatus(),
                order.getOrderedAt(),
                reservation == null || reservation.getStatus() != BookingStatus.CHECKED_IN);
    }

    private static MenuItem findItem(HotelData db, String id) {
        MenuItem item = db.menuItem(id);
        if (item == null) {
            throw new ResourceNotFoundException("Menu item", id);
        }
        return item.copy();
    }

    private static void assertNameAvailable(HotelData db, String name, String exceptId) {
        db.menuItems().stream()
                .filter(m -> m.getName().equalsIgnoreCase(name) && !m.getId().equals(exceptId))
                .findFirst()
                .ifPresent(clash -> {
                    throw new BusinessRuleException("“%s” is already on the menu".formatted(clash.getName()), "name");
                });
    }

    private static MenuItem toItem(MenuItemInput input) {
        return MenuItem.builder()
                .name(input.name())
                .category(input.category())
                .price(MoneyUtils.scale(input.price()))
                .vegetarian(input.isVegetarian())
                .available(input.available())
                .build();
    }

    /** Same rules and messages as the frontend's menuItemSchema. */
    static MenuItemInput validateMenuItem(MenuItemInput input) {
        InputValidator v = new InputValidator();
        v.text("name", input.name()).min(2, "Enter the dish name").max(60, "At most 60 characters");
        v.required("category", input.category(), "Choose a category");
        v.number("price", input.price()).required("Enter the price").min(10, "Minimum ₹10").max(20_000, "Maximum ₹20,000")
                .cents("Use at most 2 decimal places");
        v.required("isVegetarian", input.isVegetarian(), "Choose vegetarian or not");
        v.required("available", input.available(), "Choose whether the dish is available");
        v.throwIfInvalid();
        return input;
    }

    /** Same rules and messages as the frontend's orderInputSchema. */
    private static void validateOrder(OrderInput input) {
        InputValidator v = new InputValidator();
        v.text("reservationId", input.reservationId()).min(1, "Choose the guest or room to charge");
        List<OrderLineInput> items = input.items() == null ? List.of() : input.items();
        if (items.isEmpty()) {
            v.reject("items", "Add at least one dish");
        } else if (items.size() > 30) {
            v.reject("items", "At most 30 different dishes per order");
        } else if (new HashSet<>(items.stream().map(OrderLineInput::menuItemId).toList()).size() != items.size()) {
            v.reject("items", "Each dish can appear only once");
        }
        for (OrderLineInput line : items) {
            v.rejectIf(line.menuItemId() == null || line.menuItemId().isBlank(), "items", "Choose a dish");
            if (line.quantity() == null || line.quantity() < 1) {
                v.reject("items", "At least 1");
            } else if (line.quantity() > MAX_ORDER_QUANTITY) {
                v.reject("items", "At most " + MAX_ORDER_QUANTITY + " of one dish");
            }
        }
        v.throwIfInvalid();
    }
}
