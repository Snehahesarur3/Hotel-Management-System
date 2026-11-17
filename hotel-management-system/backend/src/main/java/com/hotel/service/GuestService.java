package com.hotel.service;

import com.hotel.dto.GuestDtos.GuestHistory;
import com.hotel.dto.GuestDtos.GuestInput;
import com.hotel.dto.GuestDtos.GuestSummary;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;

import java.util.List;

/** /api/guests: profiles and stay history. Identity numbers are stored masked. */
public interface GuestService {

    PageResponse<GuestSummary> list(ListQuery query, String nationality);

    GuestSummary get(String id);

    /** Distinct nationalities, alphabetical. */
    List<String> nationalities();

    GuestHistory history(String id);

    GuestSummary create(GuestInput input);

    GuestSummary update(String id, GuestInput input);

    /** Only guests without reservations. */
    void delete(String id);
}
