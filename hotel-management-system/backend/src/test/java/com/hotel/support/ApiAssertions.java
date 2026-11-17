package com.hotel.support;

import com.hotel.exception.ApiException;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/** Assertions for the errors services throw (status, message, field messages). */
public final class ApiAssertions {

    private ApiAssertions() {
    }

    /** Asserts the call fails with this HTTP status and returns the error for further checks. */
    public static ApiException rejected(ThrowingCallable call, int status) {
        ApiException error = catchThrowableOfType(ApiException.class, call);
        assertThat(error).as("expected an ApiException with status %d", status).isNotNull();
        assertThat(error.getStatus().value()).as("status of: %s", error.getMessage()).isEqualTo(status);
        return error;
    }

    public static ApiException rejected(ThrowingCallable call, int status, String message) {
        ApiException error = rejected(call, status);
        assertThat(error.getMessage()).isEqualTo(message);
        return error;
    }

    /** Asserts a 400 with exactly these field messages. */
    public static void invalid(ThrowingCallable call, Map<String, String> fieldErrors) {
        ApiException error = rejected(call, 400);
        assertThat(error.getFieldErrors()).containsExactlyInAnyOrderEntriesOf(fieldErrors);
    }
}
