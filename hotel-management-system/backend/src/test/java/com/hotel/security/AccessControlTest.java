package com.hotel.security;

import com.hotel.support.IntegrationTest;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * The role matrix in {@link SecurityConfig#accessRules}. Each row is a request a role may (ALLOW) or may not (DENY) make;
 * an allowed request may still fail validation, so ALLOW only asserts it was not rejected with 401/403.
 */
class AccessControlTest extends IntegrationTest {

    @ParameterizedTest(name = "{0} {1} {2} -> {3}")
    @CsvSource(delimiter = '|', textBlock = """
            # every role
            housekeeping | GET    | /api/dashboard/summary                         | ALLOW
            restaurant   | GET    | /api/rooms                                     | ALLOW
            # rooms
            reception    | POST   | /api/rooms                                     | DENY
            housekeeping | PATCH  | /api/rooms/RM-107/status                       | ALLOW
            restaurant   | PATCH  | /api/rooms/RM-107/status                       | DENY
            manager      | PUT    | /api/rooms/RM-101                              | ALLOW
            # guests and reservations
            reception    | POST   | /api/guests                                    | ALLOW
            reception    | DELETE | /api/guests/GST-0001                           | DENY
            housekeeping | GET    | /api/guests                                    | DENY
            reception    | POST   | /api/reservations                              | ALLOW
            restaurant   | GET    | /api/reservations                              | DENY
            # front desk: the restaurant may see who is in-house, nothing more
            restaurant   | GET    | /api/front-desk/overview                       | ALLOW
            restaurant   | POST   | /api/front-desk/check-in/BK-0027               | DENY
            reception    | POST   | /api/front-desk/check-out/BK-0015              | ALLOW
            # billing
            reception    | POST   | /api/billing/invoices/BK-0021/payments         | ALLOW
            reception    | POST   | /api/billing/invoices/BK-0021/refund           | DENY
            manager      | POST   | /api/billing/invoices/BK-0021/refund           | ALLOW
            reception    | DELETE | /api/billing/invoices/BK-0021/adjustments/ADJ-1 | DENY
            housekeeping | GET    | /api/payments                                  | DENY
            # housekeeping
            reception    | GET    | /api/housekeeping/tasks                        | ALLOW
            reception    | POST   | /api/housekeeping/tasks                        | DENY
            housekeeping | PATCH  | /api/housekeeping/tasks/HK-0002/status         | ALLOW
            # restaurant
            reception    | POST   | /api/restaurant/orders                         | ALLOW
            reception    | POST   | /api/restaurant/menu                           | DENY
            restaurant   | POST   | /api/restaurant/menu                           | ALLOW
            housekeeping | GET    | /api/restaurant/menu                           | DENY
            # staff, inventory, reports
            reception    | GET    | /api/staff                                     | DENY
            manager      | POST   | /api/staff                                     | ALLOW
            housekeeping | POST   | /api/inventory/items/INV-0001/stock-out        | ALLOW
            housekeeping | POST   | /api/inventory/items                           | DENY
            reception    | GET    | /api/inventory/items                           | DENY
            restaurant   | GET    | /api/reports/revenue                           | DENY
            # settings: managers read, only the administrator edits
            manager      | GET    | /api/settings                                  | ALLOW
            reception    | GET    | /api/settings                                  | DENY
            manager      | PUT    | /api/settings                                  | DENY
            admin        | PUT    | /api/settings                                  | ALLOW
            manager      | GET    | /api/reports/revenue                           | ALLOW
            """)
    void enforcesTheRoleMatrix(String user, String method, String path, String expected) throws Exception {
        int status = mockMvc.perform(request(HttpMethod.valueOf(method), path)
                        .with(httpBasic(user, user + "123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andReturn().getResponse().getStatus();
        if (expected.equals("DENY")) {
            assertThat(status).as("%s %s %s", user, method, path).isEqualTo(403);
        } else {
            assertThat(status).as("%s %s %s", user, method, path).isNotIn(401, 403);
        }
    }

    @ParameterizedTest(name = "{0} posts a discount -> {1}")
    @CsvSource({"reception, 403", "manager, 200", "admin, 200"})
    void onlyManagersAndAdminsGiveDiscounts(String user, int expected) throws Exception {
        int status = mockMvc.perform(request(HttpMethod.POST, "/api/billing/invoices/BK-0021/adjustments")
                        .with(httpBasic(user, user + "123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"DISCOUNT\",\"description\":\"Loyalty\",\"percent\":10}"))
                .andReturn().getResponse().getStatus();
        assertThat(status).isEqualTo(expected);

        // Extra charges are fine for the front desk.
        int extra = mockMvc.perform(request(HttpMethod.POST, "/api/billing/invoices/BK-0021/adjustments")
                        .with(httpBasic(user, user + "123"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"EXTRA\",\"description\":\"Laundry\",\"amount\":300,\"gstPercent\":18}"))
                .andReturn().getResponse().getStatus();
        assertThat(extra).isEqualTo(200);
    }
}
