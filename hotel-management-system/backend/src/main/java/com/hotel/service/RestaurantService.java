package com.hotel.service;

import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.MenuItemInput;
import com.hotel.dto.OperationsDtos.MenuItemView;
import com.hotel.dto.OperationsDtos.OrderInput;
import com.hotel.dto.OperationsDtos.OrderView;
import com.hotel.dto.OperationsDtos.RestaurantSummary;
import com.hotel.dto.PageResponse;
import com.hotel.enums.MenuCategory;
import com.hotel.enums.OrderStatus;

/** /api/restaurant: menu and orders charged to in-house stays. */
public interface RestaurantService {

    RestaurantSummary summary();

    PageResponse<MenuItemView> menu(ListQuery query, MenuCategory category, Boolean vegetarian, Boolean available);

    MenuItemView createMenuItem(MenuItemInput input);

    MenuItemView updateMenuItem(String id, MenuItemInput input);

    MenuItemView setAvailability(String id, Boolean available);

    /** Only dishes that were never ordered. */
    void deleteMenuItem(String id);

    /** {@code date} (yyyy-MM-dd) filters by order date. */
    PageResponse<OrderView> orders(ListQuery query, OrderStatus status, String date);

    OrderView createOrder(OrderInput input);

    OrderView updateOrderStatus(String id, OrderStatus status);
}
