package com.sneha.hotel.controller;

import com.sneha.hotel.dto.BookingResponse;
import com.sneha.hotel.entity.Customer;
import com.sneha.hotel.service.BookingService;
import com.sneha.hotel.service.CustomerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;
    private final BookingService bookingService;

    public CustomerController(CustomerService customerService, BookingService bookingService) {
        this.customerService = customerService;
        this.bookingService = bookingService;
    }

    @GetMapping
    public List<Customer> getAll() {
        return customerService.getAll();
    }

    @GetMapping("/{id}")
    public Customer getOne(@PathVariable Long id) {
        return customerService.get(id);
    }

    // GET /api/customers/1/bookings — booking history of one customer
    @GetMapping("/{id}/bookings")
    public List<BookingResponse> bookings(@PathVariable Long id) {
        return bookingService.getByCustomer(id);
    }

    @PostMapping
    public ResponseEntity<Customer> register(@Valid @RequestBody Customer customer) {
        return ResponseEntity.status(HttpStatus.CREATED).body(customerService.register(customer));
    }

    @PutMapping("/{id}")
    public Customer update(@PathVariable Long id, @Valid @RequestBody Customer customer) {
        return customerService.update(id, customer);
    }
}
