package com.hotel.service.impl;

import com.hotel.calculation.Summaries;
import com.hotel.dto.GuestDtos.GuestHistory;
import com.hotel.dto.GuestDtos.GuestInput;
import com.hotel.dto.GuestDtos.GuestStats;
import com.hotel.dto.GuestDtos.GuestSummary;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.entity.Guest;
import com.hotel.entity.Payment;
import com.hotel.entity.Reservation;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.IdProofType;
import com.hotel.exception.BusinessRuleException;
import com.hotel.exception.ResourceNotFoundException;
import com.hotel.exception.ValidationException;
import com.hotel.repository.BaseRepository;
import com.hotel.service.GuestService;
import com.hotel.store.DataStore;
import com.hotel.store.HotelClock;
import com.hotel.store.HotelData;
import com.hotel.util.InputValidator;
import com.hotel.util.ListQueries;
import com.hotel.util.TextMatching;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Guests (frontend mock/services/guests.ts):
 * <ul>
 *   <li>identity numbers are masked before storage (only the last 4 characters are kept);</li>
 *   <li>email addresses are unique, ignoring case;</li>
 *   <li>previous stays and last stay are derived from reservations, never stored;</li>
 *   <li>guests with reservations cannot be deleted, so booking history stays intact.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class GuestServiceImpl implements GuestService {

    /** Accepted formats per document type (spaces and dashes are ignored). */
    static final Map<IdProofType, IdRule> ID_RULES = Map.of(
            IdProofType.PASSPORT, new IdRule(Pattern.compile("^[A-Z0-9]{6,9}$"), "6–9 letters or digits"),
            IdProofType.NATIONAL_ID, new IdRule(Pattern.compile("^\\d{12}$"), "12 digits"),
            IdProofType.DRIVING_LICENSE, new IdRule(Pattern.compile("^[A-Z0-9]{10,16}$"), "10–16 letters or digits"),
            IdProofType.VOTER_ID, new IdRule(Pattern.compile("^[A-Z]{3}\\d{7}$"), "3 letters followed by 7 digits"));

    record IdRule(Pattern pattern, String hint) {
    }

    private final DataStore store;
    private final HotelClock clock;
    private final BaseRepository<Guest> guests;

    @Override
    public PageResponse<GuestSummary> list(ListQuery query, String nationality) {
        return store.read(db -> ListQueries.apply(db.guests().stream().map(g -> summarize(db, g)).toList(), query,
                ListQueries.Spec.<GuestSummary>of()
                        .search(s -> {
                            Guest g = s.guest();
                            return List.of(g.getFullName(), g.getEmail(), g.getPhone(), g.getId(), g.getNationality(), g.getAddress());
                        })
                        .filterIf(nationality, n -> s -> s.guest().getNationality().equalsIgnoreCase(n.trim()))
                        .sortBy("fullName", s -> s.guest().getFullName())
                        .sortBy("nationality", s -> s.guest().getNationality())
                        .sortBy("registrationDate", s -> s.guest().getRegistrationDate())
                        .sortBy("previousBookingCount", GuestSummary::previousBookingCount)
                        .sortBy("lastStay", GuestSummary::lastStay)
                        .defaultOrder(Comparator.comparing(s -> s.guest().getFullName(), TextMatching.NATURAL))));
    }

    @Override
    public GuestSummary get(String id) {
        return store.read(db -> summarize(db, find(db, id)));
    }

    @Override
    public List<String> nationalities() {
        return store.read(db -> db.guests().stream().map(Guest::getNationality).distinct().sorted().toList());
    }

    @Override
    public GuestHistory history(String id) {
        return store.read(db -> {
            find(db, id);
            LocalDate today = clock.today();
            List<Reservation> reservations = db.reservations().stream().filter(r -> r.getGuestId().equals(id)).toList();
            Set<String> ids = reservations.stream().map(Reservation::getId).collect(Collectors.toSet());
            List<Reservation> completed = reservations.stream().filter(r -> r.getStatus() == BookingStatus.CHECKED_OUT).toList();
            GuestStats stats = new GuestStats(
                    reservations.size(),
                    completed.size(),
                    (int) reservations.stream().filter(r -> (r.getStatus() == BookingStatus.CONFIRMED || r.getStatus() == BookingStatus.PENDING)
                            && !r.getCheckIn().isBefore(today)).count(),
                    (int) reservations.stream().filter(r -> r.getStatus() == BookingStatus.CANCELLED).count(),
                    completed.stream().mapToInt(Summaries::nightsOf).sum(),
                    Summaries.completedRevenue(db.payments(), (Payment p) -> ids.contains(p.getReservationId())));
            return new GuestHistory(stats, reservations.stream()
                    // Most recent check-in first; same-day stays by booking time, newest first.
                    .sorted(Comparator.comparing(Reservation::getCheckIn).thenComparing(Reservation::getCreatedAt).reversed())
                    .map(r -> Summaries.toReservationSummary(db, r))
                    .toList());
        });
    }

    @Override
    public GuestSummary create(GuestInput raw) {
        return store.write(() -> {
            GuestInput input = validate(raw, true);
            HotelData db = store.snapshot();
            assertEmailAvailable(db, input.email(), null);
            Guest guest = Guest.builder()
                    .fullName(input.fullName())
                    .email(input.email())
                    .phone(input.phone())
                    .address(input.address())
                    .nationality(input.nationality())
                    .idProofType(input.idProofType())
                    .idProofNumber(maskIdNumber(input.idProofType(), input.idProofNumber()))
                    .registrationDate(clock.today())
                    .build();
            Guest saved = guests.save(guest);
            return summarize(store.snapshot(), saved);
        });
    }

    @Override
    public GuestSummary update(String id, GuestInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            Guest existing = find(db, id);
            GuestInput input = validate(raw, false);
            assertEmailAvailable(db, input.email(), id);
            boolean newNumber = !input.idProofNumber().isEmpty();
            if (!newNumber && input.idProofType() != existing.getIdProofType()) {
                throw ValidationException.of("idProofNumber", "Enter the number of the new ID document");
            }
            Guest updated = existing.toBuilder()
                    .fullName(input.fullName())
                    .email(input.email())
                    .phone(input.phone())
                    .address(input.address())
                    .nationality(input.nationality())
                    .idProofType(input.idProofType())
                    .idProofNumber(newNumber ? maskIdNumber(input.idProofType(), input.idProofNumber()) : existing.getIdProofNumber())
                    .build();
            Guest saved = guests.save(updated);
            return summarize(store.snapshot(), saved);
        });
    }

    @Override
    public void delete(String id) {
        store.write(() -> {
            HotelData db = store.snapshot();
            Guest guest = find(db, id);
            long count = db.reservations().stream().filter(r -> r.getGuestId().equals(id)).count();
            if (count > 0) {
                throw new BusinessRuleException("%s has %s and cannot be deleted. Guest records with booking history are kept."
                        .formatted(guest.getFullName(), count == 1 ? "1 reservation" : count + " reservations"));
            }
            guests.deleteById(id);
        });
    }

    // ------------------------------------------------------------------ rules

    static GuestSummary summarize(HotelData db, Guest guest) {
        List<Reservation> stays = db.reservations().stream().filter(r -> r.getGuestId().equals(guest.getId())).toList();
        LocalDate lastStay = stays.stream()
                .filter(r -> r.getStatus() != BookingStatus.CANCELLED)
                .map(Reservation::getCheckIn)
                .max(Comparator.naturalOrder())
                .orElse(null);
        int previous = (int) stays.stream().filter(r -> r.getStatus() == BookingStatus.CHECKED_OUT).count();
        return new GuestSummary(guest, previous, lastStay);
    }

    private static Guest find(HotelData db, String id) {
        Guest guest = db.guest(id);
        if (guest == null) {
            throw new ResourceNotFoundException("Guest", id);
        }
        return guest.copy();
    }

    private static void assertEmailAvailable(HotelData db, String email, String exceptId) {
        db.guests().stream()
                .filter(g -> g.getEmail().equalsIgnoreCase(email) && !g.getId().equals(exceptId))
                .findFirst()
                .ifPresent(clash -> {
                    throw new BusinessRuleException("This email is already registered to " + clash.getFullName(), "email");
                });
    }

    public static String normalizeIdNumber(String value) {
        return value == null ? "" : value.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
    }

    /** PASSPORT "N1234567" -> "XXXXX4567"; other documents -> "XXXX-XXXX-4567". Full numbers are never stored. */
    public static String maskIdNumber(IdProofType type, String value) {
        String normalized = normalizeIdNumber(value);
        String last4 = normalized.substring(Math.max(0, normalized.length() - 4));
        return type == IdProofType.PASSPORT ? "XXXXX" + last4 : "XXXX-XXXX-" + last4;
    }

    /** Same rules and messages as the frontend's guestInputSchema; returns the normalised input. */
    static GuestInput validate(GuestInput input, boolean requireIdNumber) {
        InputValidator v = new InputValidator();
        String email = input.email() == null ? "" : input.email().toLowerCase(Locale.ROOT);
        String phone = input.phone() == null ? "" : input.phone();
        String idNumber = normalizeIdNumber(input.idProofNumber());
        v.text("fullName", input.fullName()).min(2, "Enter the full name").max(80, "At most 80 characters")
                .matches(InputValidator.NAME, "Use letters, spaces, apostrophes, dots or hyphens");
        v.text("email", email).matches(InputValidator.EMAIL, "Enter a valid email address").max(120, "Enter a valid email address");
        v.text("phone", phone).matches(InputValidator.PHONE, "Enter a valid phone number, e.g. +91 98450 12345")
                .satisfies(p -> p.replaceAll("\\D", "").length() >= 7, "Enter a valid phone number, e.g. +91 98450 12345");
        v.text("address", input.address()).min(5, "Enter the address").max(200, "At most 200 characters");
        v.text("nationality", input.nationality()).min(2, "Enter the nationality").max(40, "At most 40 characters");
        v.required("idProofType", input.idProofType(), "Select an ID proof type");
        if (idNumber.isEmpty()) {
            v.rejectIf(requireIdNumber, "idProofNumber", "Enter the ID number");
        } else if (input.idProofType() != null) {
            IdRule rule = ID_RULES.get(input.idProofType());
            v.rejectIf(!rule.pattern().matcher(idNumber).matches(), "idProofNumber", "Expected " + rule.hint());
        }
        v.throwIfInvalid();
        return new GuestInput(input.fullName(), email, phone, input.address(), input.nationality(), input.idProofType(), idNumber);
    }
}
