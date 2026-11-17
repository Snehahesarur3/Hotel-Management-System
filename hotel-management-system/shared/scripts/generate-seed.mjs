#!/usr/bin/env node
/**
 * Generates the canonical mock dataset in shared/seed/*.json.
 *
 *   node shared/scripts/generate-seed.mjs
 *
 * Deterministic (no randomness): every record is declared below, and derived values
 * (room statuses, bill amounts) are computed here so the dataset is consistent by construction.
 * Generation fails if any integrity rule is violated, so a broken dataset is never written.
 *
 * Date tokens (resolved against "today" by the frontend and backend loaders):
 *   "T+3"        -> local date, today + 3 days          (yyyy-MM-dd)
 *   "T-2@14:30"  -> local date-time, today - 2 at 14:30 (yyyy-MM-ddTHH:mm:ss)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed')
const SEED_VERSION = 1

// ---------------------------------------------------------------- helpers
const pad = (n, w = 4) => String(n).padStart(w, '0')
const d = (offset) => `T${offset >= 0 ? '+' : ''}${offset}`
const dt = (offset, time) => `${d(offset)}@${time}`
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const fail = (msg) => {
  console.error(`✖ Seed integrity error: ${msg}`)
  process.exit(1)
}

// ---------------------------------------------------------------- settings
const settings = {
  seedVersion: SEED_VERSION,
  hotel: {
    name: 'Aurelia Bay Hotel',
    address: '14 Marine Crescent, Miramar, Panaji, Goa 403001, India',
    phone: '+91 832 000 0100',
    email: 'frontdesk@aureliabay.example',
    gstin: '30ABCDE1234F1Z5',
  },
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  taxes: {
    // Room GST depends on the nightly tariff; first slab whose maxRate >= rate applies.
    roomGstSlabs: [
      { maxRate: 7500, percent: 12 },
      { maxRate: null, percent: 18 },
    ],
    foodGstPercent: 5,
  },
}

function roomGstPercent(rate) {
  return settings.taxes.roomGstSlabs.find((s) => s.maxRate === null || rate <= s.maxRate).percent
}

// ---------------------------------------------------------------- rooms (50)
const ROOM_TYPES = {
  STANDARD: {
    price: 3500, capacity: 2,
    amenities: ['Wi-Fi', 'Air Conditioning', 'Smart TV', 'Work Desk'],
    description: 'Comfortable queen room with garden view, ideal for short business or leisure stays.',
  },
  DELUXE: {
    price: 5500, capacity: 2,
    amenities: ['Wi-Fi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'Tea & Coffee Maker', 'Rain Shower'],
    description: 'Spacious king room with partial sea view and premium bath amenities.',
  },
  EXECUTIVE: {
    price: 8000, capacity: 3,
    amenities: ['Wi-Fi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'Lounge Access', 'Work Desk', 'Bathtub'],
    description: 'Executive floor room with lounge access, sea view and a dedicated work area.',
  },
  SUITE: {
    price: 12500, capacity: 4,
    amenities: ['Wi-Fi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'Lounge Access', 'Living Area', 'Bathtub', 'Balcony'],
    description: 'One-bedroom suite with separate living room and private sea-facing balcony.',
  },
  PRESIDENTIAL: {
    price: 25000, capacity: 6,
    amenities: ['Wi-Fi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'Lounge Access', 'Living Area', 'Dining Area', 'Jacuzzi', 'Butler Service', 'Private Terrace'],
    description: 'Two-bedroom top-floor residence with private terrace, jacuzzi and butler service.',
  },
}

/** [floor, from, to, type] - 16 Standard, 16 Deluxe, 10 Executive, 6 Suite, 2 Presidential */
const ROOM_LAYOUT = [
  [1, 1, 10, 'STANDARD'],
  [2, 1, 6, 'STANDARD'], [2, 7, 10, 'DELUXE'],
  [3, 1, 10, 'DELUXE'],
  [4, 1, 2, 'DELUXE'], [4, 3, 10, 'EXECUTIVE'],
  [5, 1, 2, 'EXECUTIVE'], [5, 3, 8, 'SUITE'], [5, 9, 10, 'PRESIDENTIAL'],
]
const MAINTENANCE_ROOMS = new Set(['110', '305'])

const rooms = []
for (const [floor, from, to, type] of ROOM_LAYOUT) {
  for (let n = from; n <= to; n++) {
    const roomNumber = `${floor}${String(n).padStart(2, '0')}`
    const t = ROOM_TYPES[type]
    rooms.push({
      id: `RM-${roomNumber}`,
      roomNumber,
      type,
      floor,
      capacity: t.capacity,
      pricePerNight: t.price,
      amenities: t.amenities,
      status: 'AVAILABLE', // derived below
      description: t.description,
    })
  }
}
const roomByNumber = new Map(rooms.map((r) => [r.roomNumber, r]))

// ---------------------------------------------------------------- guests (30) - all fictional
const GUESTS = [
  ['Aarav Mehta', 'Indian', 'PASSPORT', '12 Carter Road, Bandra West, Mumbai 400050', 'IN'],
  ['Diya Raman', 'Indian', 'NATIONAL_ID', '7 Lavelle Road, Bengaluru 560001', 'IN'],
  ['Kabir Malhotra', 'Indian', 'DRIVING_LICENSE', 'B-41 Vasant Vihar, New Delhi 110057', 'IN'],
  ['Ananya Iyer', 'Indian', 'NATIONAL_ID', '23 Boat Club Road, Chennai 600028', 'IN'],
  ['Rohan Kulkarni', 'Indian', 'VOTER_ID', '18 Prabhat Road, Pune 411004', 'IN'],
  ['Meera Nair', 'Indian', 'PASSPORT', '5 Panampilly Nagar, Kochi 682036', 'IN'],
  ['Vihaan Chatterjee', 'Indian', 'NATIONAL_ID', '64 Ballygunge Place, Kolkata 700019', 'IN'],
  ['Ishita Bansal', 'Indian', 'DRIVING_LICENSE', '9 Civil Lines, Jaipur 302006', 'IN'],
  ['Arjun Reddy', 'Indian', 'NATIONAL_ID', '31 Road No. 12, Banjara Hills, Hyderabad 500034', 'IN'],
  ['Saanvi Deshpande', 'Indian', 'PASSPORT', '2 Dhantoli, Nagpur 440012', 'IN'],
  ['Neil Fernandes', 'Indian', 'NATIONAL_ID', '15 Fontainhas, Panaji 403001', 'IN'],
  ['Tara Joshi', 'Indian', 'VOTER_ID', '88 Rajpur Road, Dehradun 248001', 'IN'],
  ['Aditya Saxena', 'Indian', 'DRIVING_LICENSE', '27 Hazratganj, Lucknow 226001', 'IN'],
  ['Riya Kapoor', 'Indian', 'NATIONAL_ID', '11 Sector 17, Chandigarh 160017', 'IN'],
  ['Yash Agarwal', 'Indian', 'PASSPORT', '46 C.G. Road, Ahmedabad 380009', 'IN'],
  ['Kavya Pillai', 'Indian', 'NATIONAL_ID', '3 Kowdiar, Thiruvananthapuram 695003', 'IN'],
  ['Dev Bhatia', 'Indian', 'DRIVING_LICENSE', '72 Model Town, Ludhiana 141002', 'IN'],
  ['Nisha Rao', 'Indian', 'NATIONAL_ID', '19 Alkapuri, Vadodara 390007', 'IN'],
  ['Kunal Sinha', 'Indian', 'VOTER_ID', '6 Boring Road, Patna 800001', 'IN'],
  ['Pooja Hegde', 'Indian', 'NATIONAL_ID', '40 Kadri Hills, Mangaluru 575002', 'IN'],
  ['Oliver Bennett', 'British', 'PASSPORT', '22 Elmwood Avenue, Bristol BS8 1AA, United Kingdom', 'UK'],
  ['Charlotte Hughes', 'British', 'PASSPORT', '9 Rosebank Terrace, Leeds LS6 2AB, United Kingdom', 'UK'],
  ['Lukas Schneider', 'German', 'PASSPORT', 'Lindenweg 14, 80331 Munich, Germany', 'EU'],
  ['Sofia Rossi', 'Italian', 'PASSPORT', 'Via dei Fiori 8, 20121 Milan, Italy', 'EU'],
  ['Emma Laurent', 'French', 'PASSPORT', '17 Rue des Lilas, 69003 Lyon, France', 'EU'],
  ['Daniel Carter', 'American', 'PASSPORT', '410 Maple Street, Austin, TX 78701, USA', 'US'],
  ['Hannah Kim', 'American', 'PASSPORT', '85 Harbor View Drive, Seattle, WA 98101, USA', 'US'],
  ['Kenji Watanabe', 'Japanese', 'PASSPORT', '3-5-2 Sakura-cho, Setagaya, Tokyo 154-0015, Japan', 'JP'],
  ['Amelia Clarke', 'Australian', 'PASSPORT', '27 Coral Parade, Brisbane QLD 4000, Australia', 'AU'],
  ['Omar Haddad', 'Emirati', 'PASSPORT', 'Villa 12, Al Wasl Road, Dubai, UAE', 'AE'],
]
const PHONE = {
  IN: (i) => `+91 90000 ${pad(10000 + i * 37, 5)}`,
  UK: (i) => `+44 7700 900${pad(i, 3)}`, // Ofcom drama range
  EU: (i) => `+49 1520 000${pad(i, 4)}`,
  US: (i) => `+1 555 01${pad(i, 2)}`, // reserved fictional range
  JP: (i) => `+81 90 0000 ${pad(i, 4)}`,
  AU: (i) => `+61 491 570 ${pad(i, 3)}`, // ACMA fictional range
  AE: (i) => `+971 50 000 ${pad(i, 4)}`,
}
const maskedId = (type, i) =>
  type === 'PASSPORT' ? `XXXXX${pad(4000 + i * 13, 4)}` : `XXXX-XXXX-${pad(1000 + i * 271, 4).slice(-4)}`

const guests = GUESTS.map(([fullName, nationality, idProofType, address, region], idx) => {
  const i = idx + 1
  const [first, last] = fullName.toLowerCase().split(' ')
  return {
    id: `GST-${pad(i)}`,
    fullName,
    email: `${first}.${last}@example.com`,
    phone: PHONE[region](i),
    address,
    nationality,
    idProofType,
    idProofNumber: maskedId(idProofType, i), // masked placeholder - never real document numbers
    registrationDate: d(-400 + i * 9),
  }
})

// ---------------------------------------------------------------- reservations (40)
// [room, checkInOffset, checkOutOffset, guestNo, numberOfGuests, source, status, leadDays]
const RESERVATIONS = [
  // Checked out (12): 2 today, 10 earlier
  ['107', -2, 0, 1, 2, 'WEBSITE', 'CHECKED_OUT', 12],
  ['303', -3, 0, 21, 2, 'BOOKING_COM', 'CHECKED_OUT', 30],
  ['101', -6, -3, 2, 1, 'PHONE', 'CHECKED_OUT', 5],
  ['206', -11, -9, 3, 2, 'WALK_IN', 'CHECKED_OUT', 0],
  ['405', -19, -16, 22, 2, 'EXPEDIA', 'CHECKED_OUT', 45],
  ['502', -27, -24, 4, 2, 'CORPORATE', 'CHECKED_OUT', 14],
  ['201', -38, -35, 5, 2, 'WEBSITE', 'CHECKED_OUT', 20],
  ['310', -51, -48, 23, 2, 'AGODA', 'CHECKED_OUT', 60],
  ['402', -65, -62, 6, 1, 'CORPORATE', 'CHECKED_OUT', 7],
  ['109', -84, -80, 7, 2, 'BOOKING_COM', 'CHECKED_OUT', 25],
  ['507', -104, -101, 24, 3, 'EXPEDIA', 'CHECKED_OUT', 40],
  ['204', -129, -125, 8, 2, 'PHONE', 'CHECKED_OUT', 10],
  // Checked in (14): in-house now; 108/203/306 due out today, 209 arrived today
  ['102', -3, 1, 9, 2, 'WEBSITE', 'CHECKED_IN', 9],
  ['105', -2, 2, 10, 1, 'CORPORATE', 'CHECKED_IN', 6],
  ['108', -1, 0, 11, 2, 'WALK_IN', 'CHECKED_IN', 0],
  ['203', -4, 0, 25, 2, 'BOOKING_COM', 'CHECKED_IN', 21],
  ['207', -2, 3, 12, 2, 'WEBSITE', 'CHECKED_IN', 15],
  ['209', 0, 2, 13, 2, 'PHONE', 'CHECKED_IN', 3],
  ['302', -1, 3, 26, 2, 'EXPEDIA', 'CHECKED_IN', 33],
  ['306', -5, 0, 14, 1, 'CORPORATE', 'CHECKED_IN', 8],
  ['309', -2, 1, 1, 2, 'WEBSITE', 'CHECKED_IN', 10],
  ['404', -3, 2, 27, 2, 'AGODA', 'CHECKED_IN', 28],
  ['406', -1, 4, 15, 2, 'CORPORATE', 'CHECKED_IN', 12],
  ['503', -2, 2, 28, 3, 'BOOKING_COM', 'CHECKED_IN', 50],
  ['506', -1, 1, 16, 2, 'WEBSITE', 'CHECKED_IN', 18],
  ['509', -3, 3, 30, 5, 'PHONE', 'CHECKED_IN', 35],
  // Confirmed (8): 104/304/408 arrive today
  ['104', 0, 2, 17, 2, 'WEBSITE', 'CONFIRMED', 11],
  ['304', 0, 3, 29, 2, 'EXPEDIA', 'CONFIRMED', 40],
  ['408', 0, 2, 2, 2, 'CORPORATE', 'CONFIRMED', 9],
  ['106', 3, 5, 18, 2, 'BOOKING_COM', 'CONFIRMED', 16],
  ['208', 5, 8, 19, 2, 'WEBSITE', 'CONFIRMED', 20],
  ['102', 2, 4, 3, 1, 'PHONE', 'CONFIRMED', 6],
  ['504', 10, 13, 20, 4, 'AGODA', 'CONFIRMED', 25],
  ['510', 14, 17, 4, 4, 'WEBSITE', 'CONFIRMED', 30],
  // Pending (2)
  ['301', 6, 9, 5, 2, 'PHONE', 'PENDING', 2],
  ['403', 20, 22, 6, 2, 'WEBSITE', 'PENDING', 1],
  // Cancelled (4)
  ['205', 4, 6, 7, 2, 'BOOKING_COM', 'CANCELLED', 15],
  ['307', -10, -8, 8, 2, 'EXPEDIA', 'CANCELLED', 20],
  ['401', 1, 3, 22, 2, 'WEBSITE', 'CANCELLED', 18],
  ['505', -20, -17, 9, 3, 'PHONE', 'CANCELLED', 30],
]

const reservations = RESERVATIONS.map(([roomNumber, ci, co, guestNo, numberOfGuests, source, status, lead], idx) => {
  const room = roomByNumber.get(roomNumber) ?? fail(`unknown room ${roomNumber}`)
  const hour = String(9 + (idx % 10)).padStart(2, '0')
  const minute = String((idx * 7) % 60).padStart(2, '0')
  return {
    id: `BK-${pad(idx + 1)}`,
    guestId: `GST-${pad(guestNo)}`,
    roomId: room.id,
    checkIn: d(ci),
    checkOut: d(co),
    numberOfGuests,
    roomRate: room.pricePerNight,
    source,
    status,
    createdAt: dt(ci - lead, `${hour}:${minute}`),
    // internal, stripped before writing
    _ci: ci,
    _co: co,
  }
})

// ---------------------------------------------------------------- menu (20)
const MENU = [
  ['Masala Omelette', 'BREAKFAST', 280, false], ['Idli Sambar', 'BREAKFAST', 220, true],
  ['Aloo Paratha with Curd', 'BREAKFAST', 260, true], ['Continental Breakfast Platter', 'BREAKFAST', 450, false],
  ['Paneer Tikka', 'STARTERS', 420, true], ['Goan Prawn Rava Fry', 'STARTERS', 560, false],
  ['Crispy Corn Pepper Salt', 'STARTERS', 320, true], ['Chicken Seekh Kebab', 'STARTERS', 480, false],
  ['Goan Fish Curry with Rice', 'MAIN_COURSE', 650, false], ['Butter Chicken with Naan', 'MAIN_COURSE', 620, false],
  ['Dal Makhani with Jeera Rice', 'MAIN_COURSE', 480, true], ['Vegetable Biryani', 'MAIN_COURSE', 440, true],
  ['Bebinca', 'DESSERTS', 260, true], ['Gulab Jamun', 'DESSERTS', 180, true],
  ['Chocolate Lava Cake', 'DESSERTS', 320, true], ['Mango Kulfi', 'DESSERTS', 220, true],
  ['Fresh Lime Soda', 'BEVERAGES', 150, true], ['Masala Chai', 'BEVERAGES', 120, true],
  ['Cold Coffee', 'BEVERAGES', 220, true], ['Kokum Sherbet', 'BEVERAGES', 160, true],
]
const menuItems = MENU.map(([name, category, price, isVegetarian], idx) => ({
  id: `MNU-${pad(idx + 1)}`,
  name,
  category,
  price,
  isVegetarian,
  available: name !== 'Mango Kulfi', // seasonal item currently unavailable
}))
const menuById = new Map(menuItems.map((m) => [m.id, m]))

// ---------------------------------------------------------------- restaurant orders (15)
// [reservationId, dayOffset, time, status, [[menuNo, qty], ...]]
const ORDERS = [
  ['BK-0001', -1, '20:15', 'DELIVERED', [[9, 1], [11, 1], [17, 2]]],
  ['BK-0002', -2, '13:05', 'DELIVERED', [[6, 1], [10, 2], [13, 2]]],
  ['BK-0003', -5, '08:30', 'DELIVERED', [[2, 1], [18, 1]]],
  ['BK-0004', -10, '21:00', 'DELIVERED', [[12, 1], [14, 1]]],
  ['BK-0013', -2, '19:40', 'DELIVERED', [[5, 1], [10, 1], [17, 2]]],
  ['BK-0013', 0, '08:10', 'DELIVERED', [[1, 2], [18, 2]]],
  ['BK-0016', -1, '22:20', 'DELIVERED', [[8, 1], [19, 1]]],
  ['BK-0019', -1, '13:30', 'DELIVERED', [[9, 2], [20, 2]]],
  ['BK-0021', -1, '20:45', 'CANCELLED', [[15, 1]]],
  ['BK-0021', 0, '07:35', 'SERVED', [[4, 1], [19, 1]]],
  ['BK-0024', -1, '21:10', 'DELIVERED', [[6, 2], [9, 2], [13, 2], [17, 4]]],
  ['BK-0025', 0, '07:55', 'PREPARING', [[3, 2], [18, 2]]],
  ['BK-0026', 0, '07:15', 'PREPARING', [[4, 3], [19, 2]]],
  ['BK-0023', 0, '07:50', 'PLACED', [[2, 2], [18, 2]]],
  ['BK-0014', 0, '08:05', 'PLACED', [[7, 1], [17, 1]]],
]
const restaurantOrders = ORDERS.map(([reservationId, day, time, status, lines], idx) => {
  const res = reservations.find((r) => r.id === reservationId) ?? fail(`order references ${reservationId}`)
  return {
    id: `ORD-${pad(idx + 1)}`,
    reservationId,
    roomId: res.roomId,
    items: lines.map(([menuNo, quantity]) => {
      const item = menuById.get(`MNU-${pad(menuNo)}`) ?? fail(`unknown menu item ${menuNo}`)
      return { menuItemId: item.id, quantity, unitPrice: item.price }
    }),
    status,
    orderedAt: dt(day, time),
    _day: day,
  }
})

// ---------------------------------------------------------------- payments (25)
function billFor(reservation) {
  const nights = reservation._co - reservation._ci
  const roomCharges = reservation.roomRate * nights
  const roomTax = round2((roomCharges * roomGstPercent(reservation.roomRate)) / 100)
  const food = restaurantOrders
    .filter((o) => o.reservationId === reservation.id && o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.items.reduce((s, l) => s + l.quantity * l.unitPrice, 0), 0)
  const foodTax = round2((food * settings.taxes.foodGstPercent) / 100)
  return round2(roomCharges + roomTax + food + foodTax)
}

const METHODS = ['CREDIT_CARD', 'UPI', 'DEBIT_CARD', 'CASH', 'BANK_TRANSFER']
const payments = []
const addPayment = (reservation, amount, method, dayOffset, time, status) => {
  const n = payments.length + 1
  payments.push({
    id: `PAY-${pad(n)}`,
    reservationId: reservation.id,
    amount,
    method,
    paymentDate: dt(dayOffset, time),
    status,
    transactionReference: method === 'CASH' ? `CASH-${pad(n)}` : `MOCK-TXN-${pad(880000 + n * 113, 6)}`,
  })
}
const byStatus = (s) => reservations.filter((r) => r.status === s)

// Settlement at checkout for every checked-out stay (room + restaurant + GST)
// (Events dated today are kept in the early morning so they are never "in the future" during the working day.)
byStatus('CHECKED_OUT').forEach((r, i) => {
  const time = r._co === 0 ? `07:${pad(20 + i * 10, 2)}` : `${10 + (i % 2)}:${pad(15 + i * 3, 2)}`
  addPayment(r, billFor(r), METHODS[i % METHODS.length], r._co, time, 'COMPLETED')
})
// One-night advance at check-in for 10 of the 14 in-house stays (one card declined)
byStatus('CHECKED_IN').slice(0, 10).forEach((r, i) => {
  const advance = round2(r.roomRate * (1 + roomGstPercent(r.roomRate) / 100))
  const time = r._ci === 0 ? '06:45' : `${14 + (i % 4)}:${pad(5 + i * 4, 2)}`
  addPayment(r, advance, METHODS[(i + 2) % METHODS.length], r._ci, time, i === 4 ? 'FAILED' : 'COMPLETED')
})
// Prepaid / pending advances on upcoming stays
const upcomingPrepaid = reservations.find((r) => r.id === 'BK-0028')
addPayment(upcomingPrepaid, upcomingPrepaid.roomRate, 'CREDIT_CARD', upcomingPrepaid._ci - 30, '18:40', 'COMPLETED')
const upcomingPending = reservations.find((r) => r.id === 'BK-0034')
addPayment(upcomingPending, upcomingPending.roomRate, 'BANK_TRANSFER', -1, '12:10', 'PENDING')
// Refunded advance on a cancelled booking
const refunded = reservations.find((r) => r.id === 'BK-0039')
addPayment(refunded, refunded.roomRate, 'UPI', -5, '16:25', 'REFUNDED')

// ---------------------------------------------------------------- staff (15)
const STAFF = [
  ['Priya Menon', 'MANAGEMENT', 'General Manager', -2100, 'ACTIVE'],
  ['Rahul Desai', 'MANAGEMENT', 'Operations Manager', -1500, 'ACTIVE'],
  ['Sneha Kamat', 'RECEPTION', 'Front Office Manager', -1300, 'ACTIVE'],
  ['Aniket Naik', 'RECEPTION', 'Receptionist', -620, 'ACTIVE'],
  ['Fatima Sheikh', 'RECEPTION', 'Night Auditor', -410, 'ON_LEAVE'],
  ['Lakshmi Gaonkar', 'HOUSEKEEPING', 'Housekeeping Supervisor', -1700, 'ACTIVE'],
  ['Sunil Parab', 'HOUSEKEEPING', 'Room Attendant', -900, 'ACTIVE'],
  ['Maria D\'Souza', 'HOUSEKEEPING', 'Room Attendant', -520, 'ACTIVE'],
  ['Ganesh Shetty', 'HOUSEKEEPING', 'Room Attendant', -260, 'ACTIVE'],
  ['Vikram Chauhan', 'RESTAURANT', 'Executive Chef', -1950, 'ACTIVE'],
  ['Alisha Coutinho', 'RESTAURANT', 'Restaurant Manager', -800, 'ACTIVE'],
  ['Joel Pereira', 'RESTAURANT', 'Steward', -330, 'INACTIVE'],
  ['Ramesh Yadav', 'MAINTENANCE', 'Chief Engineer', -1400, 'ACTIVE'],
  ['Imran Khan', 'MAINTENANCE', 'Electrician', -700, 'ACTIVE'],
  ['Baldev Singh', 'SECURITY', 'Security Supervisor', -1100, 'ACTIVE'],
]
const staff = STAFF.map(([fullName, department, designation, joined, employmentStatus], idx) => {
  const slug = fullName.toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.')
  return {
    id: `STF-${pad(idx + 1)}`,
    fullName,
    email: `${slug}@aureliabay.example`,
    phone: `+91 90000 ${pad(50000 + idx * 41, 5)}`,
    department,
    designation,
    joiningDate: d(joined),
    employmentStatus,
  }
})

// ---------------------------------------------------------------- housekeeping tasks (20)
// [room, taskType, priority, status, dayOffset, staffNo, completedTime|null, notes]
const TASKS = [
  ['107', 'CHECKOUT_CLEAN', 'HIGH', 'IN_PROGRESS', 0, 7, null, 'Guest checked out this morning'],
  ['303', 'CHECKOUT_CLEAN', 'HIGH', 'PENDING', 0, 8, null, 'Guest checked out this morning'],
  ['104', 'INSPECTION', 'HIGH', 'COMPLETED', 0, 6, '07:30', 'Ready for arrival today'],
  ['304', 'INSPECTION', 'HIGH', 'COMPLETED', 0, 6, '07:40', 'Ready for arrival today'],
  ['408', 'INSPECTION', 'HIGH', 'COMPLETED', 0, 6, '07:50', 'Ready for arrival today'],
  ['102', 'DAILY_SERVICE', 'NORMAL', 'COMPLETED', 0, 7, '08:00', null],
  ['105', 'DAILY_SERVICE', 'NORMAL', 'COMPLETED', 0, 9, '08:05', null],
  ['207', 'DAILY_SERVICE', 'NORMAL', 'COMPLETED', 0, 8, '08:15', null],
  ['302', 'DAILY_SERVICE', 'NORMAL', 'IN_PROGRESS', 0, 9, null, null],
  ['404', 'DAILY_SERVICE', 'NORMAL', 'PENDING', 0, 7, null, 'Do not disturb until noon'],
  ['503', 'DAILY_SERVICE', 'NORMAL', 'PENDING', 0, 8, null, 'Extra towels requested'],
  ['509', 'DAILY_SERVICE', 'HIGH', 'IN_PROGRESS', 0, 6, null, 'VIP guest - turndown with amenities'],
  ['406', 'DAILY_SERVICE', 'NORMAL', 'COMPLETED', 0, 9, '08:25', null],
  ['110', 'DEEP_CLEAN', 'NORMAL', 'PENDING', 1, 9, null, 'After AC compressor replacement'],
  ['305', 'DEEP_CLEAN', 'LOW', 'PENDING', 2, 7, null, 'After bathroom re-grouting'],
  ['101', 'CHECKOUT_CLEAN', 'NORMAL', 'COMPLETED', -3, 7, '13:10', null],
  ['206', 'CHECKOUT_CLEAN', 'NORMAL', 'COMPLETED', -9, 8, '12:40', null],
  ['405', 'CHECKOUT_CLEAN', 'NORMAL', 'COMPLETED', -16, 9, '12:55', null],
  ['502', 'CHECKOUT_CLEAN', 'NORMAL', 'COMPLETED', -24, 6, '13:30', null],
  ['201', 'CHECKOUT_CLEAN', 'NORMAL', 'COMPLETED', -35, 7, '12:20', null],
]
const housekeepingTasks = TASKS.map(([roomNumber, taskType, priority, status, day, staffNo, done, notes], idx) => ({
  id: `HK-${pad(idx + 1)}`,
  roomId: roomByNumber.get(roomNumber)?.id ?? fail(`task room ${roomNumber}`),
  assignedStaffId: `STF-${pad(staffNo)}`,
  taskType,
  priority,
  status,
  scheduledDate: d(day),
  ...(done ? { completedAt: dt(day, done) } : {}),
  ...(notes ? { notes } : {}),
}))

// ---------------------------------------------------------------- inventory (30)
const SUPPLIERS = {
  linen: { name: 'Coastal Linen Co.', contactPerson: 'Rita Fernandes', phone: '+91 90000 70011', email: 'orders@coastallinen.example' },
  amen: { name: 'Konkan Guest Amenities', contactPerson: 'Sameer Naik', phone: '+91 90000 70022', email: 'sales@konkanamenities.example' },
  clean: { name: 'BrightCare Supplies', contactPerson: 'Neha Bhat', phone: '+91 90000 70033', email: 'support@brightcare.example' },
  food: { name: 'Mandovi Fresh Foods', contactPerson: 'Anthony Rodrigues', phone: '+91 90000 70044', email: 'fresh@mandovifoods.example' },
  maint: { name: 'Goa Hardware & Electricals', contactPerson: 'Prakash Sawant', phone: '+91 90000 70055', email: 'trade@goahardware.example' },
  office: { name: 'PaperTrail Stationers', contactPerson: 'Leena Kamat', phone: '+91 90000 70066', email: 'orders@papertrail.example' },
}
// [name, category, unit, quantity, minStockLevel, unitCost, supplierKey, lastRestockedOffset]
const INVENTORY = [
  ['Bath Towel (White)', 'LINEN', 'pcs', 320, 200, 450, 'linen', -12],
  ['Hand Towel (White)', 'LINEN', 'pcs', 280, 200, 180, 'linen', -12],
  ['King Bed Sheet Set', 'LINEN', 'sets', 140, 120, 1650, 'linen', -20],
  ['Pillow Cover', 'LINEN', 'pcs', 90, 150, 220, 'linen', -41],
  ['Bathrobe', 'LINEN', 'pcs', 60, 40, 1200, 'linen', -30],
  ['Shampoo 30 ml', 'TOILETRIES', 'bottles', 850, 500, 18, 'amen', -6],
  ['Conditioner 30 ml', 'TOILETRIES', 'bottles', 640, 500, 18, 'amen', -6],
  ['Body Wash 30 ml', 'TOILETRIES', 'bottles', 410, 500, 20, 'amen', -27],
  ['Soap Bar 40 g', 'TOILETRIES', 'pcs', 1200, 600, 12, 'amen', -6],
  ['Dental Kit', 'TOILETRIES', 'kits', 380, 300, 25, 'amen', -15],
  ['Slippers (Pair)', 'TOILETRIES', 'pairs', 260, 250, 55, 'amen', -15],
  ['Floor Cleaner 5 L', 'CLEANING_SUPPLIES', 'cans', 24, 15, 650, 'clean', -9],
  ['Glass Cleaner 1 L', 'CLEANING_SUPPLIES', 'bottles', 8, 20, 180, 'clean', -38],
  ['Disinfectant 5 L', 'CLEANING_SUPPLIES', 'cans', 18, 12, 820, 'clean', -9],
  ['Garbage Bags (Roll)', 'CLEANING_SUPPLIES', 'rolls', 75, 50, 140, 'clean', -9],
  ['Microfiber Cloth', 'CLEANING_SUPPLIES', 'pcs', 150, 100, 45, 'clean', -22],
  ['Basmati Rice 25 kg', 'FOOD_BEVERAGE', 'bags', 14, 10, 2400, 'food', -4],
  ['Cooking Oil 15 L', 'FOOD_BEVERAGE', 'tins', 6, 8, 2100, 'food', -18],
  ['Coffee Beans 1 kg', 'FOOD_BEVERAGE', 'packs', 22, 10, 950, 'food', -10],
  ['Assam Tea 1 kg', 'FOOD_BEVERAGE', 'packs', 16, 8, 520, 'food', -10],
  ['Mineral Water 1 L', 'FOOD_BEVERAGE', 'bottles', 480, 400, 20, 'food', -3],
  ['Fresh Cream 1 L', 'FOOD_BEVERAGE', 'packs', 12, 10, 260, 'food', -2],
  ['LED Bulb 9 W', 'MAINTENANCE', 'pcs', 85, 40, 110, 'maint', -33],
  ['AC Air Filter', 'MAINTENANCE', 'pcs', 30, 25, 650, 'maint', -47],
  ['Door Lock Battery (AA)', 'MAINTENANCE', 'packs', 4, 10, 240, 'maint', -55],
  ['Plumbing Sealant', 'MAINTENANCE', 'tubes', 12, 6, 190, 'maint', -60],
  ['A4 Paper Ream', 'OFFICE_SUPPLIES', 'reams', 35, 20, 290, 'office', -25],
  ['Thermal Receipt Roll', 'OFFICE_SUPPLIES', 'rolls', 40, 30, 60, 'office', -25],
  ['Key Card (RFID)', 'OFFICE_SUPPLIES', 'pcs', 180, 100, 85, 'office', -70],
  ['Ballpoint Pen (Box)', 'OFFICE_SUPPLIES', 'boxes', 14, 10, 150, 'office', -25],
]
const inventory = INVENTORY.map(([name, category, unit, quantity, minStockLevel, unitCost, sup, restocked], idx) => ({
  id: `INV-${pad(idx + 1)}`,
  name,
  category,
  unit,
  quantity,
  minStockLevel,
  unitCost,
  supplier: SUPPLIERS[sup],
  lastRestocked: d(restocked),
}))

// ---------------------------------------------------------------- derive room statuses
for (const room of rooms) {
  const active = reservations.filter((r) => r.roomId === room.id)
  if (active.some((r) => r.status === 'CHECKED_IN')) room.status = 'OCCUPIED'
  else if (active.some((r) => (r.status === 'CONFIRMED' || r.status === 'PENDING') && r._ci === 0)) room.status = 'RESERVED'
  else if (MAINTENANCE_ROOMS.has(room.roomNumber)) room.status = 'MAINTENANCE'
  else if (housekeepingTasks.some((t) => t.roomId === room.id && t.taskType === 'CHECKOUT_CLEAN' && t.status !== 'COMPLETED')) room.status = 'CLEANING'
}

// ---------------------------------------------------------------- integrity checks
const expectCount = (name, arr, n) => arr.length === n || fail(`${name}: expected ${n}, got ${arr.length}`)
expectCount('rooms', rooms, 50)
expectCount('guests', guests, 30)
expectCount('reservations', reservations, 40)
expectCount('payments', payments, 25)
expectCount('staff', staff, 15)
expectCount('menuItems', menuItems, 20)
expectCount('restaurantOrders', restaurantOrders, 15)
expectCount('inventory', inventory, 30)
expectCount('housekeepingTasks', housekeepingTasks, 20)

const ids = (arr) => new Set(arr.map((x) => x.id))
const roomIds = ids(rooms), guestIds = ids(guests), resIds = ids(reservations), staffIds = ids(staff)
for (const arr of [rooms, guests, reservations, payments, staff, menuItems, restaurantOrders, inventory, housekeepingTasks]) {
  if (ids(arr).size !== arr.length) fail('duplicate id detected')
}
for (const r of reservations) {
  if (!guestIds.has(r.guestId)) fail(`${r.id} -> missing guest ${r.guestId}`)
  if (!roomIds.has(r.roomId)) fail(`${r.id} -> missing room ${r.roomId}`)
  if (r._co <= r._ci) fail(`${r.id} check-out must be after check-in`)
  const room = rooms.find((x) => x.id === r.roomId)
  if (r.numberOfGuests > room.capacity) fail(`${r.id} exceeds capacity of ${room.roomNumber}`)
  if (r.status === 'CHECKED_IN' && !(r._ci <= 0 && r._co >= 0)) fail(`${r.id} checked in outside its stay window`)
  if (r.status === 'CHECKED_OUT' && r._co > 0) fail(`${r.id} checked out before its stay ended`)
  if ((r.status === 'CONFIRMED' || r.status === 'PENDING') && r._ci < 0) fail(`${r.id} is a no-show (past arrival)`)
}
// No overlapping non-cancelled stays in the same room (half-open intervals: back-to-back allowed)
const live = reservations.filter((r) => r.status !== 'CANCELLED')
for (let i = 0; i < live.length; i++) {
  for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j]
    if (a.roomId === b.roomId && a._ci < b._co && b._ci < a._co) fail(`overlap ${a.id} / ${b.id} in ${a.roomId}`)
  }
}
for (const p of payments) if (!resIds.has(p.reservationId)) fail(`${p.id} -> missing reservation`)
// A guest must be registered before (or when) they first book
const offsetOf = (token) => Number(token.slice(1).split('@')[0])
for (const r of reservations) {
  const guest = guests.find((g) => g.id === r.guestId)
  if (offsetOf(r.createdAt) < offsetOf(guest.registrationDate)) fail(`${r.id} was booked before ${guest.id} registered`)
}
for (const o of restaurantOrders) {
  const r = reservations.find((x) => x.id === o.reservationId)
  if (o.roomId !== r.roomId) fail(`${o.id} room mismatch`)
  if (o._day < r._ci || o._day > r._co) fail(`${o.id} ordered outside the stay`)
}
for (const t of housekeepingTasks) {
  if (!roomIds.has(t.roomId)) fail(`${t.id} -> missing room`)
  const s = staff.find((x) => x.id === t.assignedStaffId)
  if (!s || s.department !== 'HOUSEKEEPING') fail(`${t.id} must be assigned to housekeeping staff`)
}
if (!staff.every((s) => staffIds.has(s.id))) fail('staff ids')
// Every room with a live stay right now must be OCCUPIED, and vice versa
for (const room of rooms) {
  const inHouse = reservations.some((r) => r.roomId === room.id && r.status === 'CHECKED_IN')
  if (inHouse !== (room.status === 'OCCUPIED')) fail(`room ${room.roomNumber} status ${room.status} inconsistent with reservations`)
}

// ---------------------------------------------------------------- write
const strip = (arr) => arr.map((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_'))))
const files = {
  'settings.json': settings,
  'rooms.json': rooms,
  'guests.json': guests,
  'reservations.json': strip(reservations),
  'payments.json': payments,
  'staff.json': staff,
  'menu-items.json': menuItems,
  'restaurant-orders.json': strip(restaurantOrders),
  'inventory.json': inventory,
  'housekeeping-tasks.json': housekeepingTasks,
}
mkdirSync(OUT_DIR, { recursive: true })
for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`)
}
const count = (s) => rooms.filter((r) => r.status === s).length
console.log(`✔ Seed v${SEED_VERSION} written to ${OUT_DIR}`)
console.log(`  rooms: AVAILABLE ${count('AVAILABLE')}, OCCUPIED ${count('OCCUPIED')}, RESERVED ${count('RESERVED')}, CLEANING ${count('CLEANING')}, MAINTENANCE ${count('MAINTENANCE')}`)
