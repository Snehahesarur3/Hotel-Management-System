package com.sneha.hotel.dto;

public record DashboardResponse(
        long totalRooms,
        long totalCustomers,
        long confirmedBookings,
        long checkedInGuests,
        long cancelledBookings
) {}
