package com.hotel.controller;

import com.hotel.dto.GuestDtos.GuestHistory;
import com.hotel.dto.GuestDtos.GuestInput;
import com.hotel.dto.GuestDtos.GuestSummary;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.service.GuestService;
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

@Tag(name = "Guests", description = "Guest profiles and stay history (identity numbers are stored masked)")
@RestController
@RequestMapping("/api/guests")
@RequiredArgsConstructor
public class GuestController {

    private final GuestService guests;

    @Operation(summary = "List guests (sort: fullName, nationality, registrationDate, previousBookingCount, lastStay)")
    @GetMapping
    public PageResponse<GuestSummary> list(ListQuery query, @RequestParam(required = false) String nationality) {
        return guests.list(query, nationality);
    }

    @GetMapping("/nationalities")
    public List<String> nationalities() {
        return guests.nationalities();
    }

    @GetMapping("/{id}")
    public GuestSummary get(@PathVariable String id) {
        return guests.get(id);
    }

    @GetMapping("/{id}/history")
    public GuestHistory history(@PathVariable String id) {
        return guests.history(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GuestSummary create(@RequestBody GuestInput input) {
        return guests.create(input);
    }

    @Operation(summary = "Update a guest (leave idProofNumber empty to keep the stored one)")
    @PutMapping("/{id}")
    public GuestSummary update(@PathVariable String id, @RequestBody GuestInput input) {
        return guests.update(id, input);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        guests.delete(id);
    }
}
