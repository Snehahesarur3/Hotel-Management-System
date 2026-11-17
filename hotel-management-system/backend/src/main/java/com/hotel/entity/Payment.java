package com.hotel.entity;

import com.hotel.enums.PaymentMethod;
import com.hotel.enums.PaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** A payment against a booking. Refunds are stored as negative completed payments. */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Payment implements Identifiable {

    private String id;
    private String reservationId;
    private BigDecimal amount;
    private PaymentMethod method;
    private LocalDateTime paymentDate;
    private PaymentStatus status;
    private String transactionReference;

    /** Detached copy (the repository never hands out its stored instance). */
    public Payment copy() {
        return toBuilder().build();
    }
}
