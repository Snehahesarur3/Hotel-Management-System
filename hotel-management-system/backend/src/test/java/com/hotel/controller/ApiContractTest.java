package com.hotel.controller;

import com.hotel.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The JSON the frontend reads (frontend/src/types). These shapes are what makes switching
 * VITE_MOCK_API_ENABLED off a configuration change rather than a code change.
 */
class ApiContractTest extends IntegrationTest {

    private static MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder request) {
        return request.with(httpBasic("admin", "admin123")).contentType(MediaType.APPLICATION_JSON);
    }

    @Test
    void listEndpointsPageSearchAndSortLikeTheMockServices() throws Exception {
        mockMvc.perform(asAdmin(get("/api/rooms")).param("floor", "5").param("size", "3").param("sort", "pricePerNight,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(3))
                .andExpect(jsonPath("$.totalElements").value(10))
                .andExpect(jsonPath("$.totalPages").value(4))
                .andExpect(jsonPath("$.content", hasSize(3)))
                .andExpect(jsonPath("$.content[0].type").value("PRESIDENTIAL"));

        mockMvc.perform(asAdmin(get("/api/rooms")).param("sort", "colour,asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", startsWith("Cannot sort by 'colour'")));
        mockMvc.perform(asAdmin(get("/api/rooms")).param("size", "500"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("size must be between 1 and 200"));
        mockMvc.perform(asAdmin(get("/api/rooms")).param("status", "HAUNTED"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void viewsAreFlatAndKeepTheFrontendFieldNames() throws Exception {
        // GuestSummary = guest fields + derived values; full ID numbers never leave the API.
        mockMvc.perform(asAdmin(get("/api/guests/GST-0001")))
                .andExpect(jsonPath("$.fullName").value("Aarav Mehta"))
                .andExpect(jsonPath("$.idProofNumber").value("XXXXX4013"))
                .andExpect(jsonPath("$.previousBookingCount").value(1))
                .andExpect(jsonPath("$", not(hasKey("guest"))));
        mockMvc.perform(asAdmin(get("/api/restaurant/menu")).param("size", "200"))
                .andExpect(jsonPath("$.content[*]", everyItem(hasKey("isVegetarian"))))
                .andExpect(jsonPath("$.content[*]", everyItem(hasKey("timesOrdered"))));
        mockMvc.perform(asAdmin(get("/api/reservations/BK-0021")))
                .andExpect(jsonPath("$.guestName").exists())
                .andExpect(jsonPath("$.quote.gstPercent").value(12))
                .andExpect(jsonPath("$.createdAt", matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}")));
        // Values the frontend expects as an explicit null.
        mockMvc.perform(asAdmin(get("/api/rooms/RM-110/activity")))
                .andExpect(jsonPath("$.currentStay").value(nullValue()))
                .andExpect(jsonPath("$", hasKey("currentStay")));
        mockMvc.perform(asAdmin(get("/api/reports/occupancy")).param("from", "2026-01-01").param("to", "2026-01-31"))
                .andExpect(jsonPath("$.totals", hasKey("forecastFrom")))
                .andExpect(jsonPath("$.totals.forecastFrom").value(nullValue()));
        mockMvc.perform(asAdmin(get("/api/reports/guests")).param("from", "2026-10-13").param("to", "2026-11-11"))
                .andExpect(jsonPath("$.guests[0]", hasKey("isNew")))
                .andExpect(jsonPath("$.guests[0]", hasKey("isReturning")));
    }

    @Test
    void createReturns201DeleteReturns204AndInputIsTrimmed() throws Exception {
        String room = """
                {"roomNumber":" 111 ","floor":1,"type":"DELUXE","capacity":2,"pricePerNight":5500,
                 "amenities":["Wi-Fi"],"status":"AVAILABLE","description":"  Garden view  "}""";
        mockMvc.perform(asAdmin(post("/api/rooms")).content(room))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("RM-111"))
                .andExpect(jsonPath("$.description").value("Garden view"));
        mockMvc.perform(asAdmin(delete("/api/rooms/RM-111")))
                .andExpect(status().isNoContent());
    }

    @Test
    void errorsUseOneShapeWithFieldMessages() throws Exception {
        mockMvc.perform(asAdmin(post("/api/staff")).content("{\"fullName\":\"\",\"department\":\"RECEPTION\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.path").value("/api/staff"))
                .andExpect(jsonPath("$.fieldErrors.fullName").value("Enter the full name"))
                .andExpect(jsonPath("$.fieldErrors.joiningDate").value("Choose the joining date"));

        mockMvc.perform(asAdmin(post("/api/reservations")).content("""
                        {"guestId":"GST-0003","roomId":"RM-104","checkIn":"2026-11-12","checkOut":"2026-11-13",
                         "numberOfGuests":2,"source":"PHONE","status":"CONFIRMED"}"""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Room 104 is already booked 11 Nov – 13 Nov (BK-0027)"))
                .andExpect(jsonPath("$.fieldErrors.roomId").value("Room 104 is already booked 11 Nov – 13 Nov (BK-0027)"));

        mockMvc.perform(asAdmin(get("/api/guests/GST-9999")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Guest with id 'GST-9999' was not found"));

        // 2.5 guests is malformed, not rounded down.
        mockMvc.perform(asAdmin(post("/api/reservations")).content("{\"numberOfGuests\":2.5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", startsWith("Malformed request")));
    }

    @Test
    void protocolErrorsUseTheSameShape() throws Exception {
        mockMvc.perform(asAdmin(get("/api/no-such-module")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("No endpoint GET /api/no-such-module"));
        mockMvc.perform(asAdmin(put("/api/dashboard/summary")).content("{}"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.status").value(405));
        mockMvc.perform(post("/api/guests").with(httpBasic("admin", "admin123")).contentType(MediaType.TEXT_PLAIN).content("hello"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.message").value("Send the request body as application/json"));
        mockMvc.perform(asAdmin(get("/api/reports/occupancy")).param("from", "2026-11-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors.to").exists()); // report ranges are validated like the form
        mockMvc.perform(asAdmin(get("/api/rooms")).param("floor", "two"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", startsWith("Malformed request")));
        mockMvc.perform(asAdmin(post("/api/guests")).content("{\"idProofType\":\"LIBRARY_CARD\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", startsWith("Malformed request")));
        mockMvc.perform(asAdmin(post("/api/guests")).content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.path").value("/api/guests"));
        mockMvc.perform(asAdmin(get("/api/rooms")).param("sort", "secretField,asc"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void checkOutGoesThroughTheMockGatewayEndToEnd() throws Exception {
        mockMvc.perform(asAdmin(post("/api/front-desk/check-out/BK-0013")).content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.fieldErrors.paymentMethod").value("Choose how the guest is paying"));
        mockMvc.perform(asAdmin(post("/api/front-desk/check-out/BK-0013")).content("{\"paymentMethod\":\"UPI\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reservation.status").value("CHECKED_OUT"))
                .andExpect(jsonPath("$.payment.transactionReference", startsWith("MOCK-TXN-")))
                .andExpect(jsonPath("$.bill.balance").value(0.0))
                .andExpect(jsonPath("$.housekeepingTaskId").value("HK-0021"));
        mockMvc.perform(asAdmin(patch("/api/payments/PAY-0024/status")).content("{\"status\":\"FAILED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FAILED"));
    }
}
