package com.hotel.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Swagger UI: http://localhost:8080/swagger-ui.html ("Authorize" with a dev user). */
@Configuration
public class OpenApiConfig {

    private static final String BASIC_AUTH = "devBasicAuth";

    @Bean
    public OpenAPI hotelOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Hotel Management System API")
                        .version("0.1.0")
                        .description("""
                                REST API backed by thread-safe in-memory mock repositories.
                                Authentication is HTTP Basic with DEVELOPMENT-ONLY users \
                                (see application.yml) and is not suitable for production."""))
                .components(new Components().addSecuritySchemes(BASIC_AUTH,
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("basic")))
                .addSecurityItem(new SecurityRequirement().addList(BASIC_AUTH));
    }
}
