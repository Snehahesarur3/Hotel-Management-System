package com.hotel.service;

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

import java.util.List;

/** /api/inventory: stock levels, movements, suppliers and reorder alerts. */
public interface InventoryService {

    /** {@code stock}: LOW (includes OUT) or OUT. */
    PageResponse<InventoryItemView> list(ListQuery query, InventoryCategory category, String stock, String supplier);

    InventorySummary summary();

    List<SupplierView> suppliers();

    /** Newest first. */
    List<StockMovement> movements(String itemId);

    /** {@code quantity} is the opening stock. */
    InventoryItemView create(InventoryItemInput input);

    /** Quantity is ignored: stock only changes through movements. */
    InventoryItemView update(String id, InventoryItemInput input);

    InventoryItemView stockIn(String id, StockInInput input);

    InventoryItemView stockOut(String id, StockOutInput input);

    /** Only items with no stock and no movement history. */
    void delete(String id);
}
