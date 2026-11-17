package com.hotel.service.impl;

import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.InventoryItemInput;
import com.hotel.dto.OperationsDtos.InventoryItemView;
import com.hotel.dto.OperationsDtos.InventorySummary;
import com.hotel.dto.OperationsDtos.StockInInput;
import com.hotel.dto.OperationsDtos.StockOutInput;
import com.hotel.dto.OperationsDtos.SupplierInput;
import com.hotel.dto.OperationsDtos.SupplierView;
import com.hotel.dto.PageResponse;
import com.hotel.entity.InventoryItem;
import com.hotel.entity.InventoryItem.Supplier;
import com.hotel.entity.StockMovement;
import com.hotel.enums.InventoryCategory;
import com.hotel.enums.StockMovementType;
import com.hotel.enums.StockStatus;
import com.hotel.exception.BusinessRuleException;
import com.hotel.exception.ResourceNotFoundException;
import com.hotel.exception.ValidationException;
import com.hotel.repository.BaseRepository;
import com.hotel.service.InventoryService;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Inventory (frontend mock/services/inventory.ts):
 * <ul>
 *   <li>quantities change only through stock movements (stock-in / stock-out), each recorded with a reason and the
 *       resulting balance; editing an item never changes its quantity;</li>
 *   <li>stock-out cannot exceed the stock on hand;</li>
 *   <li>LOW = at or below the reorder level; OUT = nothing left;</li>
 *   <li>names are unique (ignoring case); only items with no stock and no movement history can be deleted.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class InventoryServiceImpl implements InventoryService {

    private static final Comparator<InventoryItem> CATALOG_ORDER = Comparator.comparing((InventoryItem i) -> i.getCategory().ordinal())
            .thenComparing(InventoryItem::getName, TextMatching.NATURAL);

    private final DataStore store;
    private final HotelClock clock;
    private final BaseRepository<InventoryItem> inventory;
    private final BaseRepository<StockMovement> movements;

    // ------------------------------------------------------------------ queries

    @Override
    public PageResponse<InventoryItemView> list(ListQuery query, InventoryCategory category, String stock, String supplier) {
        if (stock != null && !stock.isBlank() && !stock.equals("LOW") && !stock.equals("OUT")) {
            throw ValidationException.of("stock", "Use LOW or OUT");
        }
        return store.read(db -> ListQueries.apply(db.inventory().stream().map(InventoryServiceImpl::view).toList(), query,
                ListQueries.Spec.<InventoryItemView>of()
                        .search(i -> List.of(i.item().getId(), i.item().getName(), i.item().getSupplier().name(),
                                i.item().getSupplier().contactPerson(), i.item().getUnit()))
                        .filterIf(category, c -> i -> i.item().getCategory() == c)
                        .filterIf(supplier, s -> i -> i.item().getSupplier().name().equals(s))
                        .filterIf(stock, s -> i -> s.equals("OUT") ? i.stockStatus() == StockStatus.OUT : i.stockStatus() != StockStatus.IN_STOCK)
                        .sortBy("name", i -> i.item().getName())
                        .sortBy("category", i -> i.item().getCategory().ordinal())
                        .sortBy("quantity", i -> i.item().getQuantity())
                        .sortBy("unitCost", i -> i.item().getUnitCost())
                        .sortBy("stockValue", InventoryItemView::stockValue)
                        .sortBy("lastRestocked", i -> i.item().getLastRestocked())
                        .defaultOrder(Comparator.comparing(InventoryItemView::item, CATALOG_ORDER))));
    }

    @Override
    public InventorySummary summary() {
        return store.read(db -> {
            List<InventoryItemView> items = db.inventory().stream().map(InventoryServiceImpl::view).toList();
            List<InventoryItemView> reorder = items.stream()
                    .filter(i -> i.stockStatus() != StockStatus.IN_STOCK)
                    .sorted(Comparator.comparingDouble((InventoryItemView i) -> urgency(i.item()))
                            .thenComparing(i -> i.item().getName(), TextMatching.NATURAL))
                    .toList();
            return new InventorySummary(items.size(), reorder.size(),
                    (int) items.stream().filter(i -> i.stockStatus() == StockStatus.OUT).count(),
                    MoneyUtils.sum(items.stream().map(InventoryItemView::stockValue)),
                    reorder);
        });
    }

    @Override
    public List<SupplierView> suppliers() {
        return store.read(db -> {
            Map<String, List<InventoryItem>> byName = new LinkedHashMap<>();
            db.inventory().forEach(i -> byName.computeIfAbsent(i.getSupplier().name(), k -> new ArrayList<>()).add(i));
            return byName.values().stream().map(items -> {
                Supplier s = items.getFirst().getSupplier();
                List<InventoryCategory> categories = items.stream().map(InventoryItem::getCategory).distinct().toList();
                int low = (int) items.stream().filter(i -> statusOf(i) != StockStatus.IN_STOCK).count();
                return new SupplierView(s.name(), s.contactPerson(), s.phone(), s.email(), items.size(), low, categories);
            }).sorted(Comparator.comparing(SupplierView::name, TextMatching.NATURAL)).toList();
        });
    }

    @Override
    public List<StockMovement> movements(String itemId) {
        return store.read(db -> {
            find(db, itemId);
            return db.stockMovements().stream()
                    .filter(m -> m.getItemId().equals(itemId))
                    .sorted(Comparator.comparing(StockMovement::getCreatedAt).thenComparing(StockMovement::getId).reversed())
                    .toList();
        });
    }

    // ------------------------------------------------------------------ commands

    @Override
    public InventoryItemView create(InventoryItemInput raw) {
        return store.write(() -> {
            InventoryItem item = validate(raw);
            assertNameAvailable(store.snapshot(), item.getName(), null);
            item.setLastRestocked(clock.today());
            InventoryItem saved = inventory.save(item);
            if (saved.getQuantity() > 0) {
                record(saved, StockMovementType.STOCK_IN, saved.getQuantity(), "Opening stock");
            }
            return view(saved);
        });
    }

    @Override
    public InventoryItemView update(String id, InventoryItemInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            InventoryItem existing = find(db, id);
            // Quantity is managed by movements; the stored value wins over whatever the client sends.
            InventoryItem item = validate(new InventoryItemInput(raw.name(), raw.category(), raw.unit(), existing.getQuantity(),
                    raw.minStockLevel(), raw.unitCost(), raw.supplier()));
            assertNameAvailable(db, item.getName(), id);
            item.setId(id);
            item.setLastRestocked(existing.getLastRestocked());
            return view(inventory.save(item));
        });
    }

    @Override
    public InventoryItemView stockIn(String id, StockInInput raw) {
        return store.write(() -> {
            InventoryItem item = find(store.snapshot(), id);
            InputValidator v = new InputValidator();
            wholeNumber(v, "quantity", raw.quantity(), "quantity", 1);
            reason(v, raw.reason());
            if (raw.unitCost() != null) {
                unitCost(v, "unitCost", raw.unitCost());
            }
            v.throwIfInvalid();
            item.setQuantity(item.getQuantity() + raw.quantity());
            if (raw.unitCost() != null) {
                item.setUnitCost(MoneyUtils.scale(raw.unitCost()));
            }
            item.setLastRestocked(clock.today());
            InventoryItem saved = inventory.save(item);
            record(saved, StockMovementType.STOCK_IN, raw.quantity(), raw.reason());
            return view(saved);
        });
    }

    @Override
    public InventoryItemView stockOut(String id, StockOutInput raw) {
        return store.write(() -> {
            InventoryItem item = find(store.snapshot(), id);
            InputValidator v = new InputValidator();
            wholeNumber(v, "quantity", raw.quantity(), "quantity", 1);
            reason(v, raw.reason());
            v.throwIfInvalid();
            if (raw.quantity() > item.getQuantity()) {
                throw new BusinessRuleException("Only %d %s in stock".formatted(item.getQuantity(), item.getUnit()), "quantity");
            }
            item.setQuantity(item.getQuantity() - raw.quantity());
            InventoryItem saved = inventory.save(item);
            record(saved, StockMovementType.STOCK_OUT, raw.quantity(), raw.reason());
            return view(saved);
        });
    }

    @Override
    public void delete(String id) {
        store.write(() -> {
            HotelData db = store.snapshot();
            InventoryItem item = find(db, id);
            if (item.getQuantity() > 0) {
                throw new BusinessRuleException("%s still has %d %s in stock. Stock it out before deleting."
                        .formatted(item.getName(), item.getQuantity(), item.getUnit()));
            }
            long history = db.stockMovements().stream().filter(m -> m.getItemId().equals(id)).count();
            if (history > 0) {
                throw new BusinessRuleException("%s has %s on record and cannot be deleted.".formatted(item.getName(),
                        Formats.plural(history, "stock movement")));
            }
            inventory.deleteById(id);
        });
    }

    // ------------------------------------------------------------------ rules

    static StockStatus statusOf(InventoryItem item) {
        return item.getQuantity() == 0 ? StockStatus.OUT
                : item.getQuantity() <= item.getMinStockLevel() ? StockStatus.LOW : StockStatus.IN_STOCK;
    }

    static InventoryItemView view(InventoryItem item) {
        return new InventoryItemView(item, statusOf(item), MoneyUtils.multiply(item.getUnitCost(), item.getQuantity()),
                Math.max(0, item.getMinStockLevel() - item.getQuantity()));
    }

    /** Lower = more urgent: share of the reorder level that is in stock. */
    private static double urgency(InventoryItem item) {
        return item.getMinStockLevel() == 0 ? 1 : (double) item.getQuantity() / item.getMinStockLevel();
    }

    private void record(InventoryItem item, StockMovementType type, int quantity, String reason) {
        movements.save(StockMovement.builder()
                .itemId(item.getId())
                .type(type)
                .quantity(quantity)
                .reason(reason)
                .balanceAfter(item.getQuantity())
                .createdAt(clock.now())
                .build());
    }

    private static InventoryItem find(HotelData db, String id) {
        return db.inventory().stream().filter(i -> i.getId().equals(id)).findFirst().map(InventoryItem::copy)
                .orElseThrow(() -> new ResourceNotFoundException("Inventory item", id));
    }

    private static void assertNameAvailable(HotelData db, String name, String exceptId) {
        db.inventory().stream()
                .filter(i -> i.getName().equalsIgnoreCase(name) && !i.getId().equals(exceptId))
                .findFirst()
                .ifPresent(clash -> {
                    throw new BusinessRuleException("“%s” is already in inventory (%s)".formatted(clash.getName(), clash.getId()), "name");
                });
    }

    private static void wholeNumber(InputValidator v, String field, Integer value, String label, long min) {
        v.number(field, value).required("Enter the " + label)
                .min(min, "The %s must be at least %d".formatted(label, min))
                .max(1_000_000, "The %s can be at most 10,00,000".formatted(label));
    }

    private static void unitCost(InputValidator v, String field, BigDecimal value) {
        v.number(field, value).required("Enter the unit cost").positive("The unit cost must be more than ₹0")
                .max(1_000_000, "The unit cost can be at most ₹10,00,000").cents("Use at most 2 decimal places");
    }

    private static void reason(InputValidator v, String reason) {
        v.text("reason", reason).min(3, "Give a reason").max(100, "At most 100 characters");
    }

    /** Same rules and messages as the frontend's inventoryItemSchema; returns the item (without id). */
    static InventoryItem validate(InventoryItemInput input) {
        InputValidator v = new InputValidator();
        v.text("name", input.name()).min(2, "Enter the item name").max(60, "At most 60 characters");
        v.required("category", input.category(), "Choose a category");
        v.text("unit", input.unit()).min(1, "Enter the unit, e.g. pcs").max(20, "At most 20 characters");
        wholeNumber(v, "quantity", input.quantity(), "opening stock", 0);
        wholeNumber(v, "minStockLevel", input.minStockLevel(), "reorder level", 0);
        unitCost(v, "unitCost", input.unitCost());
        SupplierInput s = input.supplier() == null ? new SupplierInput(null, null, null, null) : input.supplier();
        String email = s.email() == null ? "" : s.email().toLowerCase(Locale.ROOT);
        v.text("supplier.name", s.name()).min(2, "Enter the supplier").max(80, "At most 80 characters");
        v.text("supplier.contactPerson", s.contactPerson()).min(2, "Enter the contact person").max(80, "At most 80 characters");
        v.text("supplier.phone", s.phone()).matches(InputValidator.PHONE, "Enter a valid phone number");
        v.text("supplier.email", email).matches(InputValidator.EMAIL, "Enter a valid email address");
        v.throwIfInvalid();
        return InventoryItem.builder()
                .name(input.name())
                .category(input.category())
                .unit(input.unit())
                .quantity(input.quantity())
                .minStockLevel(input.minStockLevel())
                .unitCost(MoneyUtils.scale(input.unitCost()))
                .supplier(new Supplier(s.name(), s.contactPerson(), s.phone(), email))
                .build();
    }
}
