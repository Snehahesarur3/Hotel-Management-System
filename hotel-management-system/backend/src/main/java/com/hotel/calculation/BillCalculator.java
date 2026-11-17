package com.hotel.calculation;

import com.hotel.dto.BillingDtos.BillLine;
import com.hotel.dto.BillingDtos.BillOrder;
import com.hotel.dto.BillingDtos.PaymentRecord;
import com.hotel.dto.BillingDtos.StayBill;
import com.hotel.dto.BillingDtos.TaxSummaryRow;
import com.hotel.dto.ReservationDtos.StayQuote;
import com.hotel.entity.BillAdjustment;
import com.hotel.entity.Payment;
import com.hotel.entity.Reservation;
import com.hotel.entity.RestaurantOrder;
import com.hotel.entity.Room;
import com.hotel.enums.AdjustmentKind;
import com.hotel.enums.BillLineKind;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.OrderStatus;
import com.hotel.store.HotelData;
import com.hotel.util.Formats;
import com.hotel.util.MoneyUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.hotel.dto.BillingDtos.invoiceNumberFor;

/**
 * Folio calculation for a stay, shared by check-out, invoices, billing lists and reports
 * (frontend mock/calculations/billing.ts):
 * <pre>
 *   room charges (rate x nights)
 *   - discounts (fixed or % of room charges, capped at the room charges)
 *   + room GST (slab by nightly rate, on the discounted room value)
 *   + restaurant orders (cancelled excluded) + food GST (on the food total)
 *   + extra charges + GST at each extra's rate
 *   - completed payments (refunds are negative payments)
 * </pre>
 * Cancelled bookings carry no charges, so any deposit shows as a credit to refund.
 */
public final class BillCalculator {

    private BillCalculator() {
    }

    public static BigDecimal orderAmount(RestaurantOrder order) {
        return MoneyUtils.sum(order.getItems().stream().map(l -> MoneyUtils.multiply(l.unitPrice(), l.quantity())));
    }

    public static StayBill calculateStayBill(HotelData db, Reservation reservation) {
        return calculateStayBill(db, reservation, reservation.getCheckOut());
    }

    /** @param checkOut the departure to bill until (today for an early or late check-out) */
    public static StayBill calculateStayBill(HotelData db, Reservation reservation, LocalDate checkOut) {
        Room room = db.room(reservation.getRoomId());
        boolean cancelled = reservation.getStatus() == BookingStatus.CANCELLED;
        List<BillAdjustment> adjustments = cancelled ? List.of() : db.billAdjustments().stream()
                .filter(a -> a.getReservationId().equals(reservation.getId()))
                .sorted(Comparator.comparing(BillAdjustment::getCreatedAt).thenComparing(BillAdjustment::getId))
                .toList();
        List<BillLine> lines = new ArrayList<>();
        List<TaxSummaryRow> taxSummary = new ArrayList<>();

        // Room. A day-use stay (in and out on the same date) is billed as one night.
        LocalDate minimumCheckOut = reservation.getCheckIn().plusDays(1);
        LocalDate billedUntil = checkOut.isAfter(minimumCheckOut) ? checkOut : minimumCheckOut;
        StayQuote quote = Pricing.quoteStay(reservation.getRoomRate(), reservation.getCheckIn(), billedUntil,
                db.settings().taxes().roomGstSlabs());
        BigDecimal roomCharges = cancelled ? MoneyUtils.scale(BigDecimal.ZERO) : quote.roomCharges();
        if (!cancelled) {
            String nights = Formats.plural(quote.nights(), "night");
            lines.add(new BillLine(BillLineKind.ROOM,
                    "Room %s · %s × %s".formatted(room == null ? "" : room.getRoomNumber(), nights, Formats.currency(reservation.getRoomRate())),
                    roomCharges, null));
        }

        // Discounts on room charges, in the order they were given and never beyond the room charges.
        BigDecimal discount = MoneyUtils.scale(BigDecimal.ZERO);
        for (BillAdjustment adj : adjustments) {
            if (adj.getKind() != AdjustmentKind.DISCOUNT) {
                continue;
            }
            BigDecimal wanted = adj.getAmount() != null
                    ? MoneyUtils.scale(adj.getAmount())
                    : MoneyUtils.percentOf(roomCharges, adj.getPercent() == null ? BigDecimal.ZERO : adj.getPercent());
            BigDecimal applied = wanted.min(roomCharges.subtract(discount));
            discount = MoneyUtils.scale(discount.add(applied));
            String description = adj.getPercent() != null
                    ? "%s (%s%% of room charges)".formatted(adj.getDescription(), adj.getPercent().stripTrailingZeros().toPlainString())
                    : adj.getDescription();
            lines.add(new BillLine(BillLineKind.DISCOUNT, description, applied.negate(), adj.getId()));
        }
        BigDecimal roomTaxable = MoneyUtils.scale(roomCharges.subtract(discount));
        int roomGstPercent = quote.gstPercent();
        BigDecimal roomGst = MoneyUtils.percentOf(roomTaxable, BigDecimal.valueOf(roomGstPercent));
        if (!cancelled) {
            lines.add(new BillLine(BillLineKind.ROOM_GST, "GST on room (%d%%)".formatted(roomGstPercent), roomGst, null));
            addTax(taxSummary, roomGstPercent, roomTaxable, roomGst);
        }

        // Restaurant.
        List<RestaurantOrder> orders = cancelled ? List.of() : db.restaurantOrders().stream()
                .filter(o -> o.getReservationId().equals(reservation.getId()) && o.getStatus() != OrderStatus.CANCELLED)
                .sorted(Comparator.comparing(RestaurantOrder::getOrderedAt))
                .toList();
        BigDecimal foodCharges = MoneyUtils.sum(orders.stream().map(BillCalculator::orderAmount));
        int foodGstPercent = db.settings().taxes().foodGstPercent();
        BigDecimal foodGst = MoneyUtils.percentOf(foodCharges, BigDecimal.valueOf(foodGstPercent));
        if (!orders.isEmpty()) {
            lines.add(new BillLine(BillLineKind.FOOD,
                    "Restaurant & room service (%s)".formatted(Formats.plural(orders.size(), "order")), foodCharges, null));
            lines.add(new BillLine(BillLineKind.FOOD_GST, "GST on food (%d%%)".formatted(foodGstPercent), foodGst, null));
            addTax(taxSummary, foodGstPercent, foodCharges, foodGst);
        }

        // Extra charges, each with its own GST rate; GST lines grouped by rate.
        List<BillAdjustment> extras = adjustments.stream().filter(a -> a.getKind() == AdjustmentKind.EXTRA).toList();
        Map<Integer, BigDecimal> extraGstByRate = new LinkedHashMap<>();
        for (BillAdjustment extra : extras) {
            BigDecimal amount = MoneyUtils.scale(extra.getAmount());
            int rate = extra.getGstPercent() == null ? 0 : extra.getGstPercent();
            lines.add(new BillLine(BillLineKind.EXTRA, extra.getDescription(), amount, extra.getId()));
            BigDecimal tax = MoneyUtils.percentOf(amount, BigDecimal.valueOf(rate));
            extraGstByRate.merge(rate, tax, (a, b) -> MoneyUtils.scale(a.add(b)));
            addTax(taxSummary, rate, amount, tax);
        }
        extraGstByRate.entrySet().stream()
                .filter(e -> e.getKey() > 0)
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> lines.add(new BillLine(BillLineKind.EXTRA_GST, "GST on extras (%d%%)".formatted(e.getKey()), e.getValue(), null)));
        BigDecimal extraCharges = MoneyUtils.sum(extras.stream().map(BillAdjustment::getAmount));
        BigDecimal extraGst = MoneyUtils.sum(extraGstByRate.values());

        List<Payment> payments = db.payments().stream()
                .filter(p -> p.getReservationId().equals(reservation.getId()))
                .sorted(Comparator.comparing(Payment::getPaymentDate).reversed())
                .toList();
        BigDecimal paid = Summaries.completedRevenue(payments);
        BigDecimal total = MoneyUtils.sum(lines.stream().map(BillLine::amount));
        taxSummary.sort(Comparator.comparingInt(TaxSummaryRow::percent));

        return new StayBill(
                reservation.getId(),
                Summaries.guestName(db, reservation.getGuestId()),
                room == null ? Summaries.NO_ROOM : room.getRoomNumber(),
                reservation.getStatus(),
                reservation.getCheckIn(),
                checkOut,
                reservation.getCheckOut(),
                cancelled ? 0 : quote.nights(),
                MoneyUtils.scale(reservation.getRoomRate()),
                List.copyOf(lines),
                roomCharges,
                discount,
                roomGstPercent,
                cancelled ? MoneyUtils.scale(BigDecimal.ZERO) : roomGst,
                foodCharges,
                foodGstPercent,
                foodGst,
                extraCharges,
                extraGst,
                List.copyOf(taxSummary),
                total,
                paid,
                MoneyUtils.scale(total.subtract(paid)),
                payments,
                orders.stream().map(o -> new BillOrder(o.getId(), o.getOrderedAt(), o.getStatus(),
                        o.getItems().stream().mapToInt(RestaurantOrder.OrderLine::quantity).sum(), orderAmount(o))).toList());
    }

    private static void addTax(List<TaxSummaryRow> rows, int percent, BigDecimal taxable, BigDecimal tax) {
        if (taxable.signum() == 0) {
            return;
        }
        for (int i = 0; i < rows.size(); i++) {
            TaxSummaryRow row = rows.get(i);
            if (row.percent() == percent) {
                rows.set(i, new TaxSummaryRow(percent, MoneyUtils.scale(row.taxable().add(taxable)), MoneyUtils.scale(row.tax().add(tax))));
                return;
            }
        }
        rows.add(new TaxSummaryRow(percent, taxable, tax));
    }

    /** Every payment with its guest, room and invoice number (refunds are negative amounts). */
    public static List<PaymentRecord> paymentRecords(HotelData db) {
        return db.payments().stream().map(p -> {
            Reservation reservation = db.reservation(p.getReservationId());
            Room room = reservation == null ? null : db.room(reservation.getRoomId());
            return new PaymentRecord(
                    p.getId(),
                    p.getReservationId(),
                    invoiceNumberFor(p.getReservationId()),
                    reservation == null ? Summaries.UNKNOWN_GUEST : Summaries.guestName(db, reservation.getGuestId()),
                    room == null ? Summaries.NO_ROOM : room.getRoomNumber(),
                    p.getAmount(),
                    p.getMethod(),
                    p.getStatus(),
                    p.getPaymentDate(),
                    p.getTransactionReference());
        }).toList();
    }
}
