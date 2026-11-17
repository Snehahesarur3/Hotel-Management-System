package com.hotel.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.contains;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Boots the full context (also proves it loads) and verifies security, CORS and error wiring. */
@SpringBootTest
@AutoConfigureMockMvc
class SystemControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.dataMode").value("in-memory-mock"))
                .andExpect(header().exists("X-Request-Id"));
    }

    @Test
    void protectedEndpointReturnsJson401WithoutCredentials() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.path").value("/api/auth/me"));
    }

    @Test
    void wrongPasswordIsRejected() throws Exception {
        mockMvc.perform(get("/api/auth/me").with(httpBasic("admin", "wrong")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void devUserReceivesConfiguredRole() throws Exception {
        mockMvc.perform(get("/api/auth/me").with(httpBasic("reception", "reception123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("reception"))
                .andExpect(jsonPath("$.roles", contains("RECEPTIONIST")));
    }

    @Test
    void unknownApiRouteReturns404Json() throws Exception {
        mockMvc.perform(get("/api/does-not-exist").with(httpBasic("admin", "admin123")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void corsPreflightAllowsViteDevServer() throws Exception {
        mockMvc.perform(options("/api/rooms")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    void corsRejectsUnknownOrigin() throws Exception {
        mockMvc.perform(options("/api/rooms")
                        .header("Origin", "http://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }
}
