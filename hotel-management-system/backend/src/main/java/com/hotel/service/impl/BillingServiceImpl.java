package com.hotel.service.impl;

import com.hotel.calculation.BillCalculator;
import com.hotel.calculation.Summaries;
import com.hotel.dto.BillingDtos.AdjustmentInput;
import com.hotel.dto.BillingDtos.BillingSummary;
import com.hotel.dto.BillingDtos.GuestInfo;
import com.hotel.dto.BillingDtos.HotelInfo;
import com.hotel.dto.BillingDtos.Invoice;
import com.hotel.dto.BillingDtos.InvoiceSummary;
import com.hotel.dto.BillingDtos.PaymentInput;
import com.hotel.dto.BillingDtos.PaymentRecord;
import com.hotel.dto.BillingDtos.RefundInput;
import com.hotel.dto.BillingDtos.StayBill;
import com.hotel.dto.ListQuery;
import com.hotel.dto.PageResponse;
import com.hotel.entity.BillAdjustment;
import com.hotel.entity.Guest;
import com.hotel.entity.HotelSettings.HotelProfile;
import com.hotel.entity.Payment;
import com.hotel.entity.Reservation;
import com.hotel.entity.Room;
import com.hotel.enums.AdjustmentKind;
import com.hotel.enums.BalanceState;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.InvoiceState;
import com.hotel.enums.PaymentMethod;
import com.hotel.enums.PaymentStatus;
import com.hotel.enums.RoomType;
import com.hotel.exception.BusinessRuleException;
import com.hotel.exception.PaymentDeclinedException;
import com.hotel.exception.ResourceNotFoundException;
import com.hotel.exception.ValidationException;
import com.hotel.payment.PaymentGateway;
import com.hotel.payment.PaymentGateway.PaymentRequest;
import com.hotel.payment.PaymentGateway.PaymentResult;
import com.hotel.repository.BaseRepository;
import com.hotel.service.BillingService;
import com.hotel.store.DataStore;
import com.hotel.store.HotelClock;
import com.hotel.store.HotelData;
import com.hotel.util.Formats;
import com.hotel.util.InputValidator;
import com.hotel.util.ListQueries;
import com.hotel.util.MoneyUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.hotel.dto.BillingDtos.invoiceNumberFor;

/**
 * Billing and payments (frontend mock/services/billing.ts):
 * <ul>
 *   <li>invoices are derived from bookings, never stored: INV-0013 belongs to BK-0013;</li>
 *   <li>extras and discounts can be posted while the folio is open (upcoming or in-house); final invoices are locked;</li>
 *   <li>payments go through the payment gateway and may not exceed the balance due; credit balances are refunded in full;</li>
 *   <li>refunds are stored as negative completed payments, so revenue figures are always net;</li>
 *   <li>pending payments (e.g. bank transfers) can be confirmed or marked failed.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class BillingServiceImpl implements BillingService {

    private static final Set<Integer> EXTRA_GST_RATES = Set.of(0, 5, 12, 18);
    private static final Map<BookingStatus, InvoiceState> STATE_BY_STATUS = Map.of(
            BookingStatus.PENDING, InvoiceState.ESTIMATE,
            BookingStatus.CONFIRMED, InvoiceState.ESTIMATE,
            BookingStatus.CHECKED_IN, InvoiceState.INTERIM,
            BookingStatus.CHECKED_OUT, InvoiceState.FINAL,
            BookingStatus.CANCELLED, InvoiceState.VOID);

    private final DataStore store;
    private final HotelClock clock;
    private final PaymentGateway paymentGateway;
    private final BaseRepository<BillAdjustment> adjustments;
    private final BaseRepository<Payment> payments;

    // ------------------------------------------------------------------ queries

    @Override
    public BillingSummary summary() {
        return store.read(db -> {
            List<InvoiceSummary> invoices = db.reservations().stream().map(r -> toSummary(db, r)).toList();
            List<InvoiceSummary> owed = invoices.stream()
                    .filter(i -> (i.state() == InvoiceState.INTERIM || i.state() == InvoiceState.FINAL) && i.balance().signum() > 0)
                    .toList();
            List<InvoiceSummary> credit = invoices.stream().filter(i -> i.balance().signum() < 0).toList();
            List<Payment> pending = db.payments().stream().filter(p -> p.getStatus() == PaymentStatus.PENDING).toList();
            YearMonth month = YearMonth.from(clock.today());
            return new BillingSummary(
                    MoneyUtils.sum(owed.stream().map(InvoiceSummary::balance)),
                    owed.size(),
                    MoneyUtils.sum(credit.stream().map(i -> i.balance().negate())),
                    credit.size(),
                    Summaries.completedRevenue(db.payments(), p -> YearMonth.from(p.getPaymentDate()).equals(month)),
                    MoneyUtils.sum(pending.stream().map(Payment::getAmount)),
                    pending.size());
        });
    }

    @Override
    public PageResponse<InvoiceSummary> invoices(ListQuery query, BalanceState balance, InvoiceState state) {
        return store.read(db -> ListQueries.apply(
                db.reservations().stream().filter(r -> hasFolio(db, r)).map(r -> toSummary(db, r)).toList(), query,
                ListQueries.Spec.<InvoiceSummary>of()
                        .search(i -> List.of(i.invoiceNumber(), i.reservationId(), i.guestName(), i.roomNumber()))
                        .filterIf(balance, b -> i -> i.balanceState() == b)
                        .filterIf(state, s -> i -> i.state() == s)
                        .sortBy("invoiceNumber", InvoiceSummary::invoiceNumber)
                        .sortBy("guestName", InvoiceSummary::guestName)
                        .sortBy("checkIn", InvoiceSummary::checkIn)
                        .sortBy("checkOut", InvoiceSummary::checkOut)
                        .sortBy("total", InvoiceSummary::total)
                        .sortBy("balance", InvoiceSummary::balance)
                        .defaultOrder(Comparator.comparing(InvoiceSummary::checkIn)
                                .thenComparing(InvoiceSummary::reservationId).reversed())));
    }

    @Override
    public Invoice invoice(String reservationId) {
        return store.read(db -> buildInvoice(db, findReservation(db, reservationId)));
    }

    @Override
    public PageResponse<PaymentRecord> payments(ListQuery query, PaymentStatus status, PaymentMethod method, String from, String to) {
        LocalDate fromDate = InputValidator.optionalDate("from", from);
        LocalDate toDate = InputValidator.optionalDate("to", to);
        return store.read(db -> ListQueries.apply(BillCalculator.paymentRecords(db), query,
                ListQueries.Spec.<PaymentRecord>of()
                        .search(p -> List.of(p.id(), p.reservationId(), p.invoiceNumber(), p.guestName(), p.roomNumber(),
                                p.transactionReference()))
                        .filterIf(status, s -> p -> p.status() == s)
                        .filterIf(method, m -> p -> p.method() == m)
                        .filterIf(fromDate, f -> p -> !p.paymentDate().toLocalDate().isBefore(f))
                        .filterIf(toDate, t -> p -> !p.paymentDate().toLocalDate().isAfter(t))
                        .sortBy("paymentDate", PaymentRecord::paymentDate)
                        .sortBy("amount", PaymentRecord::amount)
                        .sortBy("guestName", PaymentRecord::guestName)
                        .sortBy("method", p -> p.method().name())
                        .sortBy("status", p -> p.status().ordinal())
                        .defaultOrder(Comparator.comparing(PaymentRecord::paymentDate)
                                .thenComparing(PaymentRecord::id).reversed())));
    }

    // ------------------------------------------------------------------ commands

    @Override
    public Invoice addAdjustment(String reservationId, AdjustmentInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            Reservation reservation = findReservation(db, reservationId);
            assertEditable(reservation);
            AdjustmentInput input = validateAdjustment(raw);

            if (input.kind() == AdjustmentKind.DISCOUNT) {
                StayBill bill = billFor(db, reservation);
                BigDecimal remaining = MoneyUtils.scale(bill.roomCharges().subtract(bill.discount()));
                BigDecimal wanted = input.amount() != null ? input.amount() : MoneyUtils.percentOf(bill.roomCharges(), input.percent());
                if (wanted.compareTo(remaining) > 0) {
                    throw ValidationException.of(input.amount() != null ? "amount" : "percent",
                            "Discounts can't exceed the room charges (%s left to discount)".formatted(Formats.currency(remaining)));
                }
            }

            adjustments.save(BillAdjustment.builder()
                    .reservationId(reservationId)
                    .kind(input.kind())
                    .description(input.description())
                    .amount(input.amount())
                    .gstPercent(input.kind() == AdjustmentKind.EXTRA ? input.gstPercent() : null)
                    .percent(input.kind() == AdjustmentKind.DISCOUNT ? input.percent() : null)
                    .createdAt(clock.now())
                    .build());
            HotelData after = store.snapshot();
            return buildInvoice(after, after.reservation(reservationId));
        });
    }

    @Override
    public Invoice removeAdjustment(String reservationId, String adjustmentId) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            Reservation reservation = findReservation(db, reservationId);
            assertEditable(reservation);
            boolean exists = db.billAdjustments().stream()
                    .anyMatch(a -> a.getId().equals(adjustmentId) && a.getReservationId().equals(reservationId));
            if (!exists) {
                throw ResourceNotFoundException.withMessage("Adjustment '%s' was not found on %s".formatted(adjustmentId, invoiceNumberFor(reservationId)));
            }
            adjustments.deleteById(adjustmentId);
            HotelData after = store.snapshot();
            return buildInvoice(after, after.reservation(reservationId));
        });
    }

    @Override
    public Payment recordPayment(String reservationId, PaymentInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            Reservation reservation = findReservation(db, reservationId);
            if (reservation.getStatus() == BookingStatus.CANCELLED) {
                throw new BusinessRuleException(reservation.getId() + " is cancelled; no payment can be taken.");
            }
            InputValidator v = new InputValidator();
            money(v, "amount", raw.amount(), "amount", 10_000_000);
            v.required("method", raw.method(), "Choose a payment method");
            v.throwIfInvalid();

            BigDecimal balance = billFor(db, reservation).balance();
            if (balance.signum() <= 0) {
                throw new BusinessRuleException(invoiceNumberFor(reservationId) + " has nothing to pay.");
            }
            if (raw.amount().compareTo(balance) > 0) {
                throw ValidationException.of("amount", "At most %s (the balance due)".formatted(Formats.currency(balance)));
            }
            PaymentResult result = paymentGateway.charge(new PaymentRequest(raw.amount(), raw.method(), reservationId));
            if (!result.approved()) {
                throw new PaymentDeclinedException("Payment declined: " + result.declineReason());
            }
            return payments.save(Payment.builder()
                    .reservationId(reservationId)
                    .amount(MoneyUtils.scale(raw.amount()))
                    .method(raw.method())
                    .paymentDate(clock.now())
                    .status(PaymentStatus.COMPLETED)
                    .transactionReference(result.transactionReference())
                    .build());
        });
    }

    @Override
    public Payment refund(String reservationId, RefundInput raw) {
        return store.write(() -> {
            HotelData db = store.snapshot();
            Reservation reservation = findReservation(db, reservationId);
            if (raw == null || raw.method() == null) {
                throw ValidationException.of("method", "Choose how the refund is paid");
            }
            BigDecimal balance = billFor(db, reservation).balance();
            if (balance.signum() >= 0) {
                throw new BusinessRuleException(invoiceNumberFor(reservationId) + " has no credit to refund.");
            }
            BigDecimal amount = balance.negate();
            PaymentResult result = paymentGateway.refund(new PaymentRequest(amount, raw.method(), reservationId));
            if (!result.approved()) {
                throw new PaymentDeclinedException("Refund declined: " + result.declineReason());
            }
            return payments.save(Payment.builder()
                    .reservationId(reservationId)
                    .amount(amount.negate())
                    .method(raw.method())
                    .paymentDate(clock.now())
                    .status(PaymentStatus.COMPLETED)
                    .transactionReference(result.transactionReference())
                    .build());
        });
    }

    @Override
    public Payment updatePaymentStatus(String paymentId, PaymentStatus status) {
        return store.write(() -> {
            Payment payment = payments.findById(paymentId).orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));
            if (payment.getStatus() != PaymentStatus.PENDING) {
                throw new BusinessRuleException("%s is %s; only pending payments can be confirmed or failed."
                        .formatted(paymentId, Formats.lowerLabel(payment.getStatus())));
            }
            if (status != PaymentStatus.COMPLETED && status != PaymentStatus.FAILED) {
                throw ValidationException.of("status", "A pending payment can only become Completed or Failed");
            }
            payment.setStatus(status);
            return payments.save(payment);
        });
    }

    // ------------------------------------------------------------------ helpers

    private static Reservation findReservation(HotelData db, String id) {
        Reservation reservation = db.reservation(id);
        if (reservation == null) {
            throw ResourceNotFoundException.withMessage("Invoice for booking '%s' was not found".formatted(id));
        }
        return reservation;
    }

    /** In-house folios run to the booked departure, or to today once the guest has overstayed. */
    private StayBill billFor(HotelData db, Reservation reservation) {
        LocalDate today = clock.today();
        LocalDate until = reservation.getStatus() == BookingStatus.CHECKED_IN && reservation.getCheckOut().isBefore(today)
                ? today : reservation.getCheckOut();
        return BillCalculator.calculateStayBill(db, reservation, until);
    }

    private static BalanceState balanceState(BigDecimal balance) {
        return balance.signum() > 0 ? BalanceState.DUE : balance.signum() < 0 ? BalanceState.CREDIT : BalanceState.SETTLED;
    }

    private InvoiceSummary toSummary(HotelData db, Reservation reservation) {
        StayBill bill = billFor(db, reservation);
        Room room = db.room(reservation.getRoomId());
        return new InvoiceSummary(
                reservation.getId(),
                invoiceNumberFor(reservation.getId()),
                reservation.getGuestId(),
                bill.guestName(),
                bill.roomNumber(),
                room == null ? RoomType.STANDARD : room.getType(),
                reservation.getCheckIn(),
                bill.checkOut(),
                reservation.getStatus(),
                STATE_BY_STATUS.get(reservation.getStatus()),
                bill.total(),
                bill.paid(),
                bill.balance(),
                balanceState(bill.balance()));
    }

    private Invoice buildInvoice(HotelData db, Reservation reservation) {
        InvoiceSummary summary = toSummary(db, reservation);
        Guest guest = db.guest(reservation.getGuestId());
        HotelProfile hotel = db.settings().hotel();
        LocalDate issuedOn = summary.state() == InvoiceState.FINAL
                ? (reservation.getCheckedOutAt() != null ? reservation.getCheckedOutAt().toLocalDate() : reservation.getCheckOut())
                : clock.today();
        return new Invoice(
                summary,
                issuedOn,
                new HotelInfo(hotel.name(), hotel.address(), hotel.phone(), hotel.email(), hotel.gstin()),
                new GuestInfo(reservation.getGuestId(),
                        guest == null ? Summaries.UNKNOWN_GUEST : guest.getFullName(),
                        guest == null ? "" : guest.getEmail(),
                        guest == null ? "" : guest.getPhone(),
                        guest == null ? "" : guest.getAddress()),
                billFor(db, reservation),
                summary.state() == InvoiceState.ESTIMATE || summary.state() == InvoiceState.INTERIM);
    }

    /** Bookings with a folio worth listing: stays that started, or anything with payments or adjustments. */
    private static boolean hasFolio(HotelData db, Reservation r) {
        return r.getStatus() == BookingStatus.CHECKED_IN
                || r.getStatus() == BookingStatus.CHECKED_OUT
                || db.payments().stream().anyMatch(p -> p.getReservationId().equals(r.getId()))
                || db.billAdjustments().stream().anyMatch(a -> a.getReservationId().equals(r.getId()));
    }

    private static void assertEditable(Reservation reservation) {
        InvoiceState state = STATE_BY_STATUS.get(reservation.getStatus());
        if (state == InvoiceState.FINAL) {
            throw new BusinessRuleException(invoiceNumberFor(reservation.getId()) + " is final. Charges can't be changed after check-out.");
        }
        if (state == InvoiceState.VOID) {
            throw new BusinessRuleException(reservation.getId() + " is cancelled; its invoice has no charges.");
        }
    }

    /** Money rules shared by the adjustment and payment schemas. */
    private static void money(InputValidator v, String field, BigDecimal value, String label, long max) {
        v.number(field, value).required("Enter the " + label)
                .positive("The " + label + " must be more than ₹0")
                .max(max, "The %s can be at most ₹%s".formatted(label, Formats.groupIndian(String.valueOf(max))))
                .cents("Use at most 2 decimal places");
    }

    /** Same rules and messages as the frontend's adjustmentInputSchema. */
    static AdjustmentInput validateAdjustment(AdjustmentInput input) {
        InputValidator v = new InputValidator();
        if (input.kind() == null) {
            throw ValidationException.of("kind", "Choose an extra charge or a discount");
        }
        if (input.kind() == AdjustmentKind.EXTRA) {
            v.text("description", input.description()).min(2, "Describe the charge").max(80, "At most 80 characters");
            money(v, "amount", input.amount(), "amount", 100_000);
            v.rejectIf(input.gstPercent() == null || !EXTRA_GST_RATES.contains(input.gstPercent()), "gstPercent", "Choose a GST rate");
            v.throwIfInvalid();
            return new AdjustmentInput(AdjustmentKind.EXTRA, input.description(), MoneyUtils.scale(input.amount()), input.gstPercent(), null);
        }
        v.text("description", input.description()).min(2, "Give a reason for the discount").max(80, "At most 80 characters");
        if (input.amount() != null) {
            money(v, "amount", input.amount(), "discount", 500_000);
        }
        if (input.percent() != null) {
            v.number("percent", input.percent()).min(1, "At least 1%").max(100, "At most 100%").tenths("Use at most 1 decimal place");
        }
        if ((input.amount() == null) == (input.percent() == null)) {
            v.reject("amount", "Enter either an amount or a percentage");
        }
        v.throwIfInvalid();
        return new AdjustmentInput(AdjustmentKind.DISCOUNT, input.description(),
                input.amount() == null ? null : MoneyUtils.scale(input.amount()), null, input.percent());
    }
}
