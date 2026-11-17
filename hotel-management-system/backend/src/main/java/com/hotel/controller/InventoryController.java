package com.hotel.controller;

import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.InventoryItemInput;
import com.hotel.dto.OperationsDtos.InventoryItemView;
import com.hotel.dto.OperationsDtos.InventorySummary;
import com.hotel.dto.OperationsDtos.StockInInput;
import com.hotel.dto.OperationsDtos.StockOutInput;
import com.hotel.dto.OperationsDtos.SupplierView;
import com.hotel.dto.PageResponse;
import com.hotel.entity.StockMovement;
import com.hotel.enums.InventoryCategory;
import com.hotel.service.InventoryService;
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

import java.util.List;

@Tag(name = "Inventory", description = "Stock levels, movements, suppliers and reorder alerts")
@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventory;

    @Operation(summary = "Items; stock=LOW (includes OUT) or OUT (sort: name, category, quantity, unitCost, stockValue, lastRestocked)")
    @GetMapping("/items")
    public PageResponse<InventoryItemView> list(ListQuery query,
                                                @RequestParam(required = false) InventoryCategory category,
                                                @RequestParam(required = false) String stock,
                                                @RequestParam(required = false) String supplier) {
        return inventory.list(query, category, stock, supplier);
    }

    @Operation(summary = "Totals and the reorder list, most urgent first")
    @GetMapping("/summary")
    public InventorySummary summary() {
        return inventory.summary();
    }

    @GetMapping("/suppliers")
    public List<SupplierView> suppliers() {
        return inventory.suppliers();
    }

    @GetMapping("/items/{id}/movements")
    public List<StockMovement> movements(@PathVariable String id) {
        return inventory.movements(id);
    }

    @Operation(summary = "Add an item; quantity is the opening stock (recorded as a movement)")
    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    public InventoryItemView create(@RequestBody InventoryItemInput input) {
        return inventory.create(input);
    }

    @Operation(summary = "Edit an item; quantity is ignored (use stock-in / stock-out)")
    @PutMapping("/items/{id}")
    public InventoryItemView update(@PathVariable String id, @RequestBody InventoryItemInput input) {
        return inventory.update(id, input);
    }

    @PostMapping("/items/{id}/stock-in")
    public InventoryItemView stockIn(@PathVariable String id, @RequestBody StockInInput input) {
        return inventory.stockIn(id, input);
    }

    @PostMapping("/items/{id}/stock-out")
    public InventoryItemView stockOut(@PathVariable String id, @RequestBody StockOutInput input) {
        return inventory.stockOut(id, input);
    }

    @Operation(summary = "Delete an item with no stock and no movement history")
    @DeleteMapping("/items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        inventory.delete(id);
    }
}
