package com.hotel.calculation;

import com.hotel.dto.BillingDtos.PaymentRecord;
import com.hotel.dto.BillingDtos.StayBill;
import com.hotel.dto.ReportDtos.ChargesBreakdown;
import com.hotel.dto.ReportDtos.GuestReport;
import com.hotel.dto.ReportDtos.GuestReportRow;
import com.hotel.dto.ReportDtos.GuestTotals;
import com.hotel.dto.ReportDtos.NationalityRow;
import com.hotel.dto.ReportDtos.OccupancyNight;
import com.hotel.dto.ReportDtos.OccupancyReport;
import com.hotel.dto.ReportDtos.OccupancyTotals;
import com.hotel.dto.ReportDtos.PaymentMethodRow;
import com.hotel.dto.ReportDtos.PaymentReport;
import com.hotel.dto.ReportDtos.PaymentStatusRow;
import com.hotel.dto.ReportDtos.PaymentTotals;
import com.hotel.dto.ReportDtos.ReportRange;
import com.hotel.dto.ReportDtos.ReservationReport;
import com.hotel.dto.ReportDtos.ReservationRoomTypeRow;
import com.hotel.dto.ReportDtos.ReservationSourceRow;
import com.hotel.dto.ReportDtos.ReservationTotals;
import com.hotel.dto.ReportDtos.RevenuePeriod;
import com.hotel.dto.ReportDtos.RevenueReport;
import com.hotel.dto.ReportDtos.RevenueShare;
import com.hotel.dto.ReportDtos.RevenueTotals;
import com.hotel.dto.ReportDtos.RoomPerformance;
import com.hotel.dto.ReportDtos.RoomTypePerformance;
import com.hotel.dto.ReportDtos.StatusCount;
import com.hotel.entity.Guest;
import com.hotel.entity.Payment;
import com.hotel.entity.Reservation;
import com.hotel.entity.Room;
import com.hotel.enums.BookingSource;
import com.hotel.enums.BookingStatus;
import com.hotel.enums.PaymentMethod;
import com.hotel.enums.PaymentStatus;
import com.hotel.enums.ReportGrouping;
import com.hotel.enums.RoomType;
import com.hotel.store.HotelData;
import com.hotel.util.MoneyUtils;
import com.hotel.util.TextMatching;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;

/**
 * Report calculations (frontend mock/calculations/reports.ts). Ranges are inclusive and validated before they get here.
 * <ul>
 *   <li>Revenue and payments are a cash view: payments by payment date, refunds (negative payments) netted off.</li>
 *   <li>Occupancy counts room nights; a night belongs to its start date. Past nights count stays that happened;
 *       tonight onwards also counts confirmed and pending bookings.</li>
 *   <li>Reservations and guests are selected by arrival (check-in) date.</li>
 *   <li>"Room revenue" is the nightly rate x nights, before discounts and tax.</li>
 * </ul>
 */
public final class ReportCalculator {

    private static final Set<BookingStatus> STAYED = Set.of(BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT);
    private static final Set<BookingStatus> UPCOMING = Set.of(BookingStatus.PENDING, BookingStatus.CONFIRMED);
    private static final BigDecimal ZERO = MoneyUtils.scale(BigDecimal.ZERO);

    private ReportCalculator() {
    }

    // ------------------------------------------------------------------ periods

    static boolean inRange(LocalDate date, ReportRange range) {
        return !date.isBefore(range.from()) && !date.isAfter(range.to());
    }

    /** Every date in an inclusive range, oldest first. */
    public static List<LocalDate> datesIn(ReportRange range) {
        return range.from().datesUntil(range.to().plusDays(1)).toList();
    }

    public static String periodKey(LocalDate date, ReportGrouping groupBy) {
        return switch (groupBy) {
            case DAY -> date.toString();
            case MONTH -> date.toString().substring(0, 7);
            case YEAR -> date.toString().substring(0, 4);
        };
    }

    /** The period keys that overlap the range, oldest first. */
    public static List<String> periodsIn(ReportRange range, ReportGrouping groupBy) {
        return List.copyOf(new LinkedHashSet<>(datesIn(range).stream().map(d -> periodKey(d, groupBy)).toList()));
    }

    private record Cash(BigDecimal collected, BigDecimal refunded, BigDecimal net, int transactions) {
    }

    private static Cash cash(List<Payment> payments) {
        BigDecimal collected = MoneyUtils.sum(payments.stream().map(Payment::getAmount).filter(a -> a.signum() > 0));
        BigDecimal refunded = MoneyUtils.sum(payments.stream().map(Payment::getAmount).filter(a -> a.signum() < 0).map(BigDecimal::negate));
        return new Cash(collected, refunded, MoneyUtils.scale(collected.subtract(refunded)), payments.size());
    }

    private static List<Payment> completedIn(HotelData db, ReportRange range) {
        return db.payments().stream()
                .filter(p -> p.getStatus() == PaymentStatus.COMPLETED && inRange(p.getPaymentDate().toLocalDate(), range))
                .toList();
    }

    // ------------------------------------------------------------------ revenue

    public static RevenueReport revenue(HotelData db, ReportRange range, ReportGrouping groupBy) {
        List<Payment> payments = completedIn(db, range);
        Cash totals = cash(payments);

        List<RevenuePeriod> periods = periodsIn(range, groupBy).stream().map(period -> {
            Cash c = cash(payments.stream().filter(p -> periodKey(p.getPaymentDate().toLocalDate(), groupBy).equals(period)).toList());
            return new RevenuePeriod(period, c.collected(), c.refunded(), c.net(), c.transactions());
        }).toList();

        List<RevenueShare<BookingSource>> bySource = shares(BookingSource.values(), payments, totals.net(), p -> {
            Reservation r = db.reservation(p.getReservationId());
            return r == null ? null : r.getSource();
        });
        List<RevenueShare<RoomType>> byRoomType = shares(RoomType.values(), payments, totals.net(), p -> {
            Reservation r = db.reservation(p.getReservationId());
            Room room = r == null ? null : db.room(r.getRoomId());
            return room == null ? null : room.getType();
        });

        List<StayBill> bills = db.reservations().stream()
                .filter(r -> r.getStatus() == BookingStatus.CHECKED_OUT && inRange(r.getCheckOut(), range))
                .map(r -> BillCalculator.calculateStayBill(db, r))
                .toList();
        ChargesBreakdown charges = new ChargesBreakdown(
                bills.size(),
                MoneyUtils.sum(bills.stream().map(StayBill::roomCharges)),
                MoneyUtils.sum(bills.stream().map(StayBill::discount)),
                MoneyUtils.sum(bills.stream().map(StayBill::foodCharges)),
                MoneyUtils.sum(bills.stream().map(StayBill::extraCharges)),
                MoneyUtils.sum(bills.stream().flatMap(b -> Stream.of(b.roomGst(), b.foodGst(), b.extraGst()))),
                MoneyUtils.sum(bills.stream().map(StayBill::total)));

        return new RevenueReport(range.from(), range.to(), groupBy,
                new RevenueTotals(totals.collected(), totals.refunded(), totals.net(), totals.transactions(),
                        MoneyUtils.perUnit(totals.net(), datesIn(range).size())),
                periods, bySource, byRoomType, charges);
    }

    private static <K> List<RevenueShare<K>> shares(K[] keys, List<Payment> payments, BigDecimal totalNet, Function<Payment, K> keyOf) {
        return Arrays.stream(keys).map(key -> {
            List<Payment> own = payments.stream().filter(p -> key.equals(keyOf.apply(p))).toList();
            BigDecimal net = MoneyUtils.sum(own.stream().map(Payment::getAmount));
            return new RevenueShare<>(key, net, own.size(), MoneyUtils.percent(net, totalNet));
        }).sorted(Comparator.comparing((RevenueShare<K> s) -> s.net()).reversed()).toList();
    }

    // ------------------------------------------------------------------ occupancy

    /** Whether the booking holds its room on {@code night}. */
    static boolean holdsNight(Reservation r, LocalDate night, LocalDate today) {
        if (night.isBefore(r.getCheckIn()) || !night.isBefore(r.getCheckOut())) {
            return false;
        }
        return STAYED.contains(r.getStatus()) || (!night.isBefore(today) && UPCOMING.contains(r.getStatus()));
    }

    private static final class RoomStats {
        int nightsSold;
        BigDecimal roomRevenue = ZERO;
        final Set<String> stays = new HashSet<>();
    }

    public static OccupancyReport occupancy(HotelData db, ReportRange range, LocalDate today) {
        int totalRooms = db.rooms().size();
        List<LocalDate> dates = datesIn(range);
        List<Reservation> candidates = db.reservations().stream()
                .filter(r -> !r.getCheckIn().isAfter(range.to()) && r.getCheckOut().isAfter(range.from()) && r.getStatus() != BookingStatus.CANCELLED)
                .toList();
        Map<String, RoomStats> perRoom = new LinkedHashMap<>();
        db.rooms().forEach(room -> perRoom.put(room.getId(), new RoomStats()));

        List<OccupancyNight> nights = dates.stream().map(date -> {
            Map<String, Reservation> sold = new LinkedHashMap<>();
            for (Reservation r : candidates) {
                if (holdsNight(r, date, today)) {
                    sold.putIfAbsent(r.getRoomId(), r);
                }
            }
            sold.forEach((roomId, r) -> {
                RoomStats stats = perRoom.get(roomId);
                if (stats != null) {
                    stats.nightsSold += 1;
                    stats.roomRevenue = MoneyUtils.scale(stats.roomRevenue.add(r.getRoomRate()));
                    stats.stays.add(r.getId());
                }
            });
            return new OccupancyNight(date, sold.size(), totalRooms, MoneyUtils.percent(sold.size(), totalRooms),
                    MoneyUtils.sum(sold.values().stream().map(Reservation::getRoomRate)), !date.isBefore(today));
        }).toList();

        List<RoomPerformance> rooms = db.rooms().stream().map(room -> {
            RoomStats stats = perRoom.get(room.getId());
            return new RoomPerformance(room.getId(), room.getRoomNumber(), room.getType(), room.getFloor(), stats.stays.size(),
                    stats.nightsSold, MoneyUtils.percent(stats.nightsSold, dates.size()), stats.roomRevenue,
                    MoneyUtils.perUnit(stats.roomRevenue, stats.nightsSold));
        }).sorted(Comparator.comparingInt(RoomPerformance::nightsSold).reversed()
                .thenComparing(RoomPerformance::roomRevenue, Comparator.reverseOrder())
                .thenComparing(RoomPerformance::roomNumber, TextMatching.NATURAL)).toList();

        List<RoomTypePerformance> byRoomType = Arrays.stream(RoomType.values()).map(type -> {
            List<RoomPerformance> ofType = rooms.stream().filter(r -> r.type() == type).toList();
            int available = ofType.size() * dates.size();
            int sold = ofType.stream().mapToInt(RoomPerformance::nightsSold).sum();
            BigDecimal revenue = MoneyUtils.sum(ofType.stream().map(RoomPerformance::roomRevenue));
            return new RoomTypePerformance(type, ofType.size(), available, sold, MoneyUtils.percent(sold, available), revenue,
                    MoneyUtils.perUnit(revenue, sold), MoneyUtils.perUnit(revenue, available));
        }).toList();

        int available = totalRooms * dates.size();
        int sold = nights.stream().mapToInt(OccupancyNight::occupiedRooms).sum();
        BigDecimal revenue = MoneyUtils.sum(nights.stream().map(OccupancyNight::roomRevenue));
        LocalDate forecastFrom = nights.stream().filter(OccupancyNight::forecast).map(OccupancyNight::date).findFirst().orElse(null);
        return new OccupancyReport(range.from(), range.to(),
                new OccupancyTotals(dates.size(), available, sold, MoneyUtils.percent(sold, available), revenue,
                        MoneyUtils.perUnit(revenue, sold), MoneyUtils.perUnit(revenue, available), forecastFrom),
                nights, byRoomType, rooms);
    }

    // ------------------------------------------------------------------ reservations

    private static long leadTimeDays(Reservation r) {
        return Math.max(0, ChronoUnit.DAYS.between(r.getCreatedAt().toLocalDate(), r.getCheckIn()));
    }

    public static ReservationReport reservations(HotelData db, ReportRange range) {
        List<Reservation> arriving = db.reservations().stream()
                .filter(r -> inRange(r.getCheckIn(), range))
                .sorted(Comparator.comparing(Reservation::getCheckIn).thenComparing(Reservation::getId))
                .toList();
        List<Reservation> live = arriving.stream().filter(r -> r.getStatus() != BookingStatus.CANCELLED).toList();
        int roomNights = live.stream().mapToInt(Summaries::nightsOf).sum();
        int cancelled = arriving.size() - live.size();

        ReservationTotals totals = new ReservationTotals(
                arriving.size(),
                cancelled,
                MoneyUtils.percent(cancelled, arriving.size()),
                roomNights,
                MoneyUtils.sum(live.stream().map(Summaries::stayAmount)),
                MoneyUtils.average(roomNights, live.size()),
                MoneyUtils.average(live.stream().mapToLong(ReportCalculator::leadTimeDays).sum(), live.size()),
                MoneyUtils.average(live.stream().mapToInt(Reservation::getNumberOfGuests).sum(), live.size()));

        List<StatusCount> byStatus = Arrays.stream(BookingStatus.values())
                .map(s -> new StatusCount(s, (int) arriving.stream().filter(r -> r.getStatus() == s).count()))
                .toList();
        List<ReservationSourceRow> bySource = Arrays.stream(BookingSource.values()).map(source -> {
            List<Reservation> own = arriving.stream().filter(r -> r.getSource() == source).toList();
            List<Reservation> ownLive = own.stream().filter(r -> r.getStatus() != BookingStatus.CANCELLED).toList();
            return new ReservationSourceRow(source, own.size(), own.size() - ownLive.size(),
                    ownLive.stream().mapToInt(Summaries::nightsOf).sum(), MoneyUtils.sum(ownLive.stream().map(Summaries::stayAmount)));
        }).sorted(Comparator.comparingInt(ReservationSourceRow::reservations).reversed()
                .thenComparing(ReservationSourceRow::roomRevenue, Comparator.reverseOrder())).toList();
        List<ReservationRoomTypeRow> byRoomType = Arrays.stream(RoomType.values()).map(type -> {
            List<Reservation> own = live.stream().filter(r -> {
                Room room = db.room(r.getRoomId());
                return room != null && room.getType() == type;
            }).toList();
            return new ReservationRoomTypeRow(type, own.size(), own.stream().mapToInt(Summaries::nightsOf).sum(),
                    MoneyUtils.sum(own.stream().map(Summaries::stayAmount)));
        }).toList();

        return new ReservationReport(range.from(), range.to(), totals, byStatus, bySource, byRoomType,
                arriving.stream().map(r -> Summaries.toReservationSummary(db, r)).toList());
    }

    // ------------------------------------------------------------------ guests

    public static GuestReport guests(HotelData db, ReportRange range) {
        List<Reservation> stays = db.reservations().stream()
                .filter(r -> r.getStatus() != BookingStatus.CANCELLED && inRange(r.getCheckIn(), range))
                .toList();
        Map<String, List<Reservation>> byGuest = new LinkedHashMap<>();
        stays.forEach(r -> byGuest.computeIfAbsent(r.getGuestId(), k -> new ArrayList<>()).add(r));

        List<GuestReportRow> rows = byGuest.entrySet().stream().map(entry -> {
            String guestId = entry.getKey();
            List<Reservation> own = entry.getValue();
            Guest guest = db.guest(guestId);
            return new GuestReportRow(
                    guestId,
                    guest == null ? Summaries.UNKNOWN_GUEST : guest.getFullName(),
                    guest == null ? "Unknown" : guest.getNationality(),
                    own.size(),
                    own.stream().mapToInt(Summaries::nightsOf).sum(),
                    MoneyUtils.sum(own.stream().map(Summaries::stayAmount)),
                    own.stream().map(Reservation::getCheckIn).max(Comparator.naturalOrder()).orElseThrow(),
                    guest != null && inRange(guest.getRegistrationDate(), range),
                    db.reservations().stream().anyMatch(r -> r.getGuestId().equals(guestId) && STAYED.contains(r.getStatus())
                            && r.getCheckIn().isBefore(range.from())));
        }).sorted(Comparator.comparing(GuestReportRow::roomRevenue, Comparator.reverseOrder())
                .thenComparing(GuestReportRow::guestName, TextMatching.NATURAL)).toList();

        Map<String, NationalityRow> nationalities = new LinkedHashMap<>();
        for (GuestReportRow row : rows) {
            NationalityRow current = nationalities.getOrDefault(row.nationality(), new NationalityRow(row.nationality(), 0, 0, 0, ZERO));
            nationalities.put(row.nationality(), new NationalityRow(current.key(), current.guests() + 1, current.stays() + row.stays(),
                    current.nights() + row.nights(), MoneyUtils.scale(current.roomRevenue().add(row.roomRevenue()))));
        }

        BigDecimal roomRevenue = MoneyUtils.sum(rows.stream().map(GuestReportRow::roomRevenue));
        return new GuestReport(range.from(), range.to(),
                new GuestTotals(rows.size(), (int) rows.stream().filter(GuestReportRow::isNew).count(),
                        (int) rows.stream().filter(GuestReportRow::isReturning).count(), stays.size(), roomRevenue,
                        MoneyUtils.perUnit(roomRevenue, rows.size())),
                nationalities.values().stream()
                        .sorted(Comparator.comparingInt(NationalityRow::guests).reversed()
                                .thenComparing(NationalityRow::roomRevenue, Comparator.reverseOrder())
                                .thenComparing(NationalityRow::key, TextMatching.NATURAL))
                        .toList(),
                rows);
    }

    // ------------------------------------------------------------------ payments

    public static PaymentReport payments(HotelData db, ReportRange range) {
        List<Payment> all = db.payments().stream().filter(p -> inRange(p.getPaymentDate().toLocalDate(), range)).toList();
        List<Payment> completed = all.stream().filter(p -> p.getStatus() == PaymentStatus.COMPLETED).toList();
        Cash totals = cash(completed);
        Function<PaymentStatus, List<Payment>> ofStatus = s -> all.stream().filter(p -> p.getStatus() == s).toList();
        Set<String> ids = new HashSet<>(all.stream().map(Payment::getId).toList());

        List<PaymentMethodRow> byMethod = Arrays.stream(PaymentMethod.values()).map(method -> {
            Cash own = cash(completed.stream().filter(p -> p.getMethod() == method).toList());
            return new PaymentMethodRow(method, own.transactions(), own.collected(), own.refunded(), own.net(),
                    MoneyUtils.percent(own.net(), totals.net()));
        }).sorted(Comparator.comparing(PaymentMethodRow::net).reversed()).toList();
        List<PaymentStatusRow> byStatus = Arrays.stream(PaymentStatus.values()).map(s -> new PaymentStatusRow(s, ofStatus.apply(s).size(),
                MoneyUtils.sum(ofStatus.apply(s).stream().map(Payment::getAmount)))).toList();
        List<PaymentRecord> rows = BillCalculator.paymentRecords(db).stream()
                .filter(p -> ids.contains(p.id()))
                .sorted(Comparator.comparing(PaymentRecord::paymentDate).thenComparing(PaymentRecord::id).reversed())
                .toList();

        List<Payment> pending = ofStatus.apply(PaymentStatus.PENDING);
        List<Payment> failed = ofStatus.apply(PaymentStatus.FAILED);
        return new PaymentReport(range.from(), range.to(),
                new PaymentTotals(all.size(), totals.collected(), totals.refunded(), totals.net(),
                        pending.size(), MoneyUtils.sum(pending.stream().map(Payment::getAmount)),
                        failed.size(), MoneyUtils.sum(failed.stream().map(Payment::getAmount))),
                byMethod, byStatus, rows);
    }
}
