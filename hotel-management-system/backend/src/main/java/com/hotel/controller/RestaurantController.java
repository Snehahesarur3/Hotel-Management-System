package com.hotel.controller;

import com.hotel.dto.ListQuery;
import com.hotel.dto.OperationsDtos.AvailabilityUpdate;
import com.hotel.dto.OperationsDtos.MenuItemInput;
import com.hotel.dto.OperationsDtos.MenuItemView;
import com.hotel.dto.OperationsDtos.OrderInput;
import com.hotel.dto.OperationsDtos.OrderStatusUpdate;
import com.hotel.dto.OperationsDtos.OrderView;
import com.hotel.dto.OperationsDtos.RestaurantSummary;
import com.hotel.dto.PageResponse;
import com.hotel.enums.MenuCategory;
import com.hotel.enums.OrderStatus;
import com.hotel.service.RestaurantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Restaurant", description = "Menu and orders charged to in-house stays")
@RestController
@RequestMapping("/api/restaurant")
@RequiredArgsConstructor
public class RestaurantController {

    private final RestaurantService restaurant;

    @Operation(summary = "Open orders, today's orders and sales, menu availability")
    @GetMapping("/summary")
    public RestaurantSummary summary() {
        return restaurant.summary();
    }

    @Operation(summary = "Menu (sort: name, category, price, timesOrdered)")
    @GetMapping("/menu")
    public PageResponse<MenuItemView> menu(ListQuery query,
                                           @RequestParam(required = false) MenuCategory category,
                                           @RequestParam(required = false) Boolean vegetarian,
                                           @RequestParam(required = false) Boolean available) {
        return restaurant.menu(query, category, vegetarian, available);
    }

    @PostMapping("/menu")
    @ResponseStatus(HttpStatus.CREATED)
    public MenuItemView createMenuItem(@RequestBody MenuItemInput input) {
        return restaurant.createMenuItem(input);
    }

    @PutMapping("/menu/{id}")
    public MenuItemView updateMenuItem(@PathVariable String id, @RequestBody MenuItemInput input) {
        return restaurant.updateMenuItem(id, input);
    }

    @PatchMapping("/menu/{id}/availability")
    public MenuItemView setAvailability(@PathVariable String id, @RequestBody AvailabilityUpdate body) {
        return restaurant.setAvailability(id, body.available());
    }

    @Operation(summary = "Delete a dish that was never ordered")
    @DeleteMapping("/menu/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMenuItem(@PathVariable String id) {
        restaurant.deleteMenuItem(id);
    }

    @Operation(summary = "Orders (sort: orderedAt, total, status, roomNumber)")
    @GetMapping("/orders")
    public PageResponse<OrderView> orders(ListQuery query,
                                          @RequestParam(required = false) OrderStatus status,
                                          @RequestParam(required = false) String date) {
        return restaurant.orders(query, status, date);
    }

    @Operation(summary = "Charge an order to an in-house stay")
    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderView createOrder(@RequestBody OrderInput input) {
        return restaurant.createOrder(input);
    }

    @Operation(summary = "Placed -> Preparing -> Served / Delivered, or Cancelled")
    @PatchMapping("/orders/{id}/status")
    public OrderView updateOrderStatus(@PathVariable String id, @RequestBody OrderStatusUpdate body) {
        return restaurant.updateOrderStatus(id, body.status());
    }
}
