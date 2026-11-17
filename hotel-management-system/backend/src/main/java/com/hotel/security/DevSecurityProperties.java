package com.hotel.security;

import com.hotel.enums.UserRole;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;
import java.util.Set;

/**
 * DEVELOPMENT-ONLY user list bound from {@code app.security.dev-users}.
 * These are fixed demo accounts, not real credentials; production must use a proper identity provider.
 */
@ConfigurationProperties(prefix = "app.security")
public record DevSecurityProperties(List<DevUser> devUsers) {

    public DevSecurityProperties {
        devUsers = devUsers == null ? List.of() : List.copyOf(devUsers);
    }

    public record DevUser(String username, String password, Set<UserRole> roles) {
    }
}
