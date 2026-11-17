package com.hotel.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.deser.std.StringDeserializer;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/** JSON conventions shared with the frontend. */
@Configuration
public class JacksonConfig {

    /** Always yyyy-MM-ddTHH:mm:ss (Jackson's default drops ":00" seconds, which breaks string comparison in the UI). */
    public static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer hotelDateTimeFormat() {
        return builder -> builder
                .serializerByType(LocalDateTime.class, new LocalDateTimeSerializer(DATE_TIME))
                .deserializerByType(LocalDateTime.class, LocalDateTimeDeserializer.INSTANCE);
    }

    /** Registered automatically by Spring Boot (every Module bean is installed in the shared ObjectMapper). */
    @Bean
    public Module trimStringsModule() {
        SimpleModule module = new SimpleModule("trim-strings");
        module.addDeserializer(String.class, new TrimmingStringDeserializer());
        return module;
    }

    /** Incoming text is trimmed, like the frontend schemas do, so "  Suite " and "Suite" are the same value. */
    static final class TrimmingStringDeserializer extends StringDeserializer {
        @Override
        public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            String value = super.deserialize(parser, context);
            return value == null ? null : value.trim();
        }
    }
}
