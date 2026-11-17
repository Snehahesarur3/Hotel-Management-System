package com.hotel.entity;

import com.hotel.enums.IdProofType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/** A guest profile. The identity number is stored masked (last 4 characters only). */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Guest implements Identifiable {

    private String id;
    private String fullName;
    private String email;
    private String phone;
    private String address;
    private String nationality;
    private IdProofType idProofType;
    /** Masked placeholder, e.g. XXXXX4567; real document numbers are never stored. */
    private String idProofNumber;
    private LocalDate registrationDate;

    /** Detached copy (the repository never hands out its stored instance). */
    public Guest copy() {
        return toBuilder().build();
    }
}
