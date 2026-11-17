package com.hotel.controller;

import com.hotel.config.CorsConfig;
import com.hotel.config.CorsProperties;
import com.hotel.dto.DashboardDtos.ReservationSummary;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.dto.ReservationDtos.ReservationInput;
import com.hotel.enums.BookingSource;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.RoomType;
import com.hotel.exception.BusinessRuleException;
import com.hotel.security.DevSecurityProperties;
import com.hotel.security.SecurityConfig;
import com.hotel.service.ReservationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Web layer only (Mockito-mocked service): request mapping, parameter binding, status codes and security. */
@WebMvcTest(ReservationController.class)
@Import({SecurityConfig.class, CorsConfig.class})
// Slices do not bind @ConfigurationProperties: the dev users and CORS origins are bound explicitly.
@EnableConfigurationProperties({DevSecurityProperties.class, CorsProperties.class})
class ReservationControllerWebMvcTest {

    private static final ReservationSummary SUMMARY = new ReservationSummary("BK-0041", "GST-0003", "Kavya Iyer", "RM-101", "101",
            RoomType.STANDARD, LocalDate.of(2026, 11, 12), LocalDate.of(2026, 11, 14), 2, 2, new BigDecimal("7000.00"),
            BookingSource.PHONE, BookingStatus.CONFIRMED, LocalDateTime.of(2026, 11, 11, 10, 0));

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ReservationService reservations;

    @Test
    void bindsPagingSearchSortAndFilters() throws Exception {
        when(reservations.list(any(), any(), any(), any(), any())).thenReturn(new PageResponse<>(List.of(SUMMARY), 1, 10, 11, 2));

        mockMvc.perform(get("/api/reservations").with(httpBasic("reception", "reception123"))
                        .param("page", "1").param("size", "10").param("search", "kavya").param("sort", "checkIn,desc")
                        .param("status", "CONFIRMED").param("from", "2026-11-01").param("to", "2026-11-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value("BK-0041"))
                .andExpect(jsonPath("$.content[0].createdAt").value("2026-11-11T10:00:00"))
                .andExpect(jsonPath("$.totalPages").value(2));

        ArgumentCaptor<ListQuery> query = ArgumentCaptor.forClass(ListQuery.class);
        verify(reservations).list(query.capture(), eq(BookingStatus.CONFIRMED), isNull(), eq("2026-11-01"), eq("2026-11-30"));
        assertThat(query.getValue()).isEqualTo(new ListQuery(1, 10, "kavya", "checkIn,desc"));
    }

    @Test
    void createReturns201AndBusinessRuleErrorsBecome409() throws Exception {
        when(reservations.create(any(ReservationInput.class))).thenReturn(SUMMARY);
        mockMvc.perform(post("/api/reservations").with(httpBasic("reception", "reception123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestId\":\"GST-0003\",\"roomId\":\"RM-101\",\"checkIn\":\"2026-11-12\",\"checkOut\":\"2026-11-14\","
                                + "\"numberOfGuests\":2,\"source\":\"PHONE\",\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalAmount").value(7000.00));

        when(reservations.cancel("BK-0013")).thenThrow(new BusinessRuleException("BK-0013 is checked in and cannot be cancelled."));
        mockMvc.perform(post("/api/reservations/BK-0013/cancel").with(httpBasic("admin", "admin123")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("BK-0013 is checked in and cannot be cancelled."));
    }

    @Test
    void rolesAreCheckedBeforeTheServiceIsCalled() throws Exception {
        mockMvc.perform(get("/api/reservations").with(httpBasic("housekeeping", "housekeeping123")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/reservations"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(reservations);
    }
}
