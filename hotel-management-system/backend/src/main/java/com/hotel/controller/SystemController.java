package com.hotel.controller;

import com.hotel.dto.CurrentUserResponse;
import com.hotel.dto.HealthResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@Tag(name = "System", description = "Health and current-user information")
@RestController
@RequestMapping("/api")
public class SystemController {

    @Operation(summary = "Liveness check (public)")
    @GetMapping("/health")
    public HealthResponse health() {
        return new HealthResponse("UP", "in-memory-mock", Instant.now());
    }

    @Operation(summary = "Returns the authenticated user and roles (used by the frontend after login)")
    @GetMapping("/auth/me")
    public CurrentUserResponse me(Authentication authentication) {
        return new CurrentUserResponse(
                authentication.getName(),
                authentication.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .map(a -> a.replaceFirst("^ROLE_", ""))
                        .sorted()
                        .toList());
    }
}
