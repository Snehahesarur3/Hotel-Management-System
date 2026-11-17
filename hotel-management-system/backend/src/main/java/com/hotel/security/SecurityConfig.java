package com.hotel.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotel.dto.ApiError;
import com.hotel.enums.UserRole;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

import java.io.IOException;
import java.util.List;

/**
 * DEVELOPMENT AUTHENTICATION - NOT FOR PRODUCTION.
 * <p>
 * Stateless HTTP Basic against in-memory demo users from {@code application.yml}.
 * Passwords are BCrypt-hashed at startup so plain text never sits in the user store,
 * but they are still committed in config, so this must be replaced (OIDC/JWT) before deployment.
 * <p>
 * Endpoint-level role rules live in {@link #accessRules} so the whole access matrix is visible in one place.
 */
@Slf4j
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private static final String ADMIN = UserRole.ADMIN.name();
    private static final String MANAGER = UserRole.MANAGER.name();
    private static final String RECEPTIONIST = UserRole.RECEPTIONIST.name();
    private static final String HOUSEKEEPING = UserRole.HOUSEKEEPING.name();
    private static final String RESTAURANT = UserRole.RESTAURANT.name();

    static final String[] PUBLIC_ENDPOINTS = {
            "/api/health",
            "/actuator/health", "/actuator/info",
            "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**"
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper objectMapper) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable) // stateless API, no cookies/sessions
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(basic -> basic.authenticationEntryPoint(
                        (req, res, ex) -> writeError(objectMapper, req, res, HttpStatus.UNAUTHORIZED,
                                "Authentication required")))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> writeError(objectMapper, req, res,
                                HttpStatus.UNAUTHORIZED, "Authentication required"))
                        .accessDeniedHandler((req, res, ex) -> writeError(objectMapper, req, res,
                                HttpStatus.FORBIDDEN, "You do not have permission to perform this action")))
                .authorizeHttpRequests(SecurityConfig::accessRules);
        return http.build();
    }

    /**
     * Who may call what. Rules are checked top to bottom, so specific paths come before broad ones.
     * One body-dependent rule lives on the controller: discounts on invoices are for Admin and Manager
     * ({@code BillingController#addAdjustment}).
     * <pre>
     * Module           Read                                 Write
     * Dashboard, rooms everyone                             rooms: Admin, Manager; room status also Reception, Housekeeping
     * Guests           Admin, Manager, Reception            same; delete: Admin, Manager
     * Reservations     Admin, Manager, Reception            same
     * Front desk       + Restaurant (overview, to find in-house guests)   Admin, Manager, Reception
     * Billing          Admin, Manager, Reception            refunds, removing adjustments, discounts: Admin, Manager
     * Housekeeping     Admin, Manager, Reception, Housekeeping           Admin, Manager, Housekeeping
     * Restaurant       Admin, Manager, Reception, Restaurant             menu: Admin, Manager, Restaurant; orders: + Reception
     * Staff            Admin, Manager                       same
     * Inventory        Admin, Manager, Housekeeping, Restaurant          stock in/out: same; items: Admin, Manager
     * Reports          Admin, Manager                       -
 * Settings         Admin, Manager                       Admin (hotel profile, check-in/out times)
     * </pre>
     */
    static void accessRules(AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry auth) {
        auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/me", "/api/dashboard/**", "/api/rooms/**").authenticated()

                .requestMatchers(HttpMethod.PATCH, "/api/rooms/*/status").hasAnyRole(ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING)
                .requestMatchers("/api/rooms/**").hasAnyRole(ADMIN, MANAGER)

                .requestMatchers(HttpMethod.DELETE, "/api/guests/**").hasAnyRole(ADMIN, MANAGER)
                .requestMatchers("/api/guests/**").hasAnyRole(ADMIN, MANAGER, RECEPTIONIST)
                .requestMatchers("/api/reservations/**").hasAnyRole(ADMIN, MANAGER, RECEPTIONIST)

                .requestMatchers(HttpMethod.GET, "/api/front-desk/overview").hasAnyRole(ADMIN, MANAGER, RECEPTIONIST, RESTAURANT)
                .requestMatchers("/api/front-desk/**").hasAnyRole(ADMIN, MANAGER, RECEPTIONIST)

                .requestMatchers(HttpMethod.POST, "/api/billing/invoices/*/refund").hasAnyRole(ADMIN, MANAGER)
                .requestMatchers(HttpMethod.DELETE, "/api/billing/invoices/*/adjustments/*").hasAnyRole(ADMIN, MANAGER)
                .requestMatchers("/api/billing/**", "/api/payments/**").hasAnyRole(ADMIN, MANAGER, RECEPTIONIST)

                .requestMatchers(HttpMethod.GET, "/api/housekeeping/**").hasAnyRole(ADMIN, MANAGER, RECEPTIONIST, HOUSEKEEPING)
                .requestMatchers("/api/housekeeping/**").hasAnyRole(ADMIN, MANAGER, HOUSEKEEPING)

                .requestMatchers("/api/restaurant/orders/**").hasAnyRole(ADMIN, MANAGER, RECEPTIONIST, RESTAURANT)
                .requestMatchers(HttpMethod.GET, "/api/restaurant/**").hasAnyRole(ADMIN, MANAGER, RECEPTIONIST, RESTAURANT)
                .requestMatchers("/api/restaurant/**").hasAnyRole(ADMIN, MANAGER, RESTAURANT)

                .requestMatchers("/api/staff/**").hasAnyRole(ADMIN, MANAGER)

                .requestMatchers(HttpMethod.GET, "/api/inventory/**").hasAnyRole(ADMIN, MANAGER, HOUSEKEEPING, RESTAURANT)
                .requestMatchers(HttpMethod.POST, "/api/inventory/items/*/stock-in", "/api/inventory/items/*/stock-out")
                .hasAnyRole(ADMIN, MANAGER, HOUSEKEEPING, RESTAURANT)
                .requestMatchers("/api/inventory/**").hasAnyRole(ADMIN, MANAGER)

                .requestMatchers("/api/reports/**").hasAnyRole(ADMIN, MANAGER)

                .requestMatchers(HttpMethod.GET, "/api/settings").hasAnyRole(ADMIN, MANAGER)
                .requestMatchers("/api/settings", "/api/settings/**").hasRole(ADMIN)

                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService(DevSecurityProperties properties, PasswordEncoder encoder) {
        List<UserDetails> users = properties.devUsers().stream()
                .map(u -> User.withUsername(u.username())
                        .password(encoder.encode(u.password()))
                        .roles(u.roles().stream().map(UserRole::name).toArray(String[]::new))
                        .build())
                .toList();
        log.warn("DEVELOPMENT authentication active with {} demo users - do not use in production", users.size());
        return new InMemoryUserDetailsManager(users);
    }

    private static void writeError(ObjectMapper mapper, HttpServletRequest req, HttpServletResponse res,
                                   HttpStatus status, String message) throws IOException {
        res.setStatus(status.value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(res.getOutputStream(),
                ApiError.of(status.value(), status.getReasonPhrase(), message, req.getRequestURI()));
    }
}
