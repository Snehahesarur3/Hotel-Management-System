# Hotel Management System — Spring Boot REST API

A backend for managing hotel rooms, customers and bookings, built with **Java 17, Spring Boot 3, Spring Data JPA (Hibernate), MySQL/H2** and **Bean Validation**.

## Features
- Room management (add, update, list, filter by type, soft-delete)
- Customer registration with validation (email, Indian mobile number)
- **Availability search** by date range and number of guests
- Booking with **automatic price calculation** (nights × price per night)
- **Double-booking prevention** using a date-overlap check plus a database row lock
- Booking lifecycle: `CONFIRMED → CHECKED_IN → CHECKED_OUT`, or `CONFIRMED → CANCELLED`
- Customer booking history and a summary dashboard
- Global exception handling with clean JSON errors (400 / 404 / 409)
- Swagger UI for testing every API in the browser
- JUnit integration tests for the booking rules

## Project structure (layered architecture)
```
com.sneha.hotel
├── controller   → REST endpoints (@RestController)
├── service      → business logic + @Transactional
├── repository   → Spring Data JPA interfaces (JpaRepository)
├── entity       → JPA entities: Room, Customer, Booking (+ enums)
├── dto          → request/response objects (Java records)
└── exception    → custom exceptions + @RestControllerAdvice
```

## How to run

**Requirements:** Java 17+ and Maven (or open in IntelliJ / Eclipse / STS as a Maven project).

### Option 1 — no database setup (H2 in-memory)
```bash
mvn spring-boot:run
```
- Swagger UI: http://localhost:8080/swagger-ui.html
- H2 console: http://localhost:8080/h2-console (JDBC URL `jdbc:h2:mem:hoteldb`, user `sa`, no password)

Sample rooms and customers are loaded from `data.sql` at startup.

### Option 2 — MySQL
1. `CREATE DATABASE hoteldb;`
2. Put your MySQL password in `src/main/resources/application-mysql.properties`
3. `mvn spring-boot:run -Dspring-boot.run.profiles=mysql`

### Run tests
```bash
mvn test
```

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rooms` | All active rooms (`?type=DELUXE` to filter) |
| GET | `/api/rooms/{id}` | One room |
| GET | `/api/rooms/available?checkIn=2026-12-01&checkOut=2026-12-03&guests=2` | Free rooms for those dates |
| POST | `/api/rooms` | Add a room |
| PUT | `/api/rooms/{id}` | Update a room |
| DELETE | `/api/rooms/{id}` | Delete (or deactivate if it has bookings) |
| GET | `/api/customers` | All customers |
| POST | `/api/customers` | Register a customer |
| GET | `/api/customers/{id}/bookings` | Booking history |
| POST | `/api/bookings` | Create a booking |
| GET | `/api/bookings` | All bookings |
| PATCH | `/api/bookings/{id}/cancel` | Cancel |
| PATCH | `/api/bookings/{id}/check-in` | Check in |
| PATCH | `/api/bookings/{id}/check-out` | Check out |
| GET | `/api/bookings/dashboard` | Counts summary |

### Example: create a booking
```http
POST /api/bookings
Content-Type: application/json

{ "roomId": 3, "customerId": 1, "checkIn": "2026-12-01", "checkOut": "2026-12-04", "guests": 2 }
```
Response `201 Created`:
```json
{ "bookingId": 1, "roomNumber": "201", "roomType": "DOUBLE", "customerName": "Rahul Sharma",
  "checkIn": "2026-12-01", "checkOut": "2026-12-04", "nights": 3, "totalAmount": 7500.00, "status": "CONFIRMED" }
```
Booking the same room for overlapping dates returns `409 Conflict`:
```json
{ "status": 409, "error": "Conflict", "message": "Room 201 is already booked for these dates" }
```

---

## Interview talking points

**"Explain your project."**
I built a REST API for hotel management using Spring Boot with a layered architecture: controllers handle HTTP, services hold the business rules, and Spring Data JPA repositories talk to MySQL. It supports room and customer management, availability search, bookings with automatic pricing, and the check-in / check-out lifecycle. I originally built it as a console app with JDBC and later rebuilt it in Spring Boot.

**"How do you prevent double booking?"**
Two date ranges overlap when `existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn`. Before saving, I check for any CONFIRMED or CHECKED_IN booking that overlaps. To stop two requests arriving at the same moment from both passing that check, I lock the room row with `@Lock(PESSIMISTIC_WRITE)` inside a `@Transactional` method, so the second request waits until the first commits.

**"Why DTOs instead of returning entities?"**
To control exactly what the client sees, avoid lazy-loading errors when serialising, and keep the API stable if the database changes.

**"What is the N+1 problem and how did you handle it?"**
Loading 50 bookings and then each booking's room and customer separately would fire 1 + 100 queries. I used `JOIN FETCH` in the repository query so everything loads in one query.

**"How is exception handling done?"**
Custom exceptions (`ResourceNotFoundException`, `BusinessException`) are thrown from the service layer, and a single `@RestControllerAdvice` class converts them into proper status codes: 404, 409, and 400 for validation failures with field-level messages.

**"Why constructor injection?"**
Dependencies can be `final`, the class can't be created in a half-initialised state, and it's easy to unit test without Spring.

**"Why soft delete for rooms?"**
Deleting a room that has past bookings would break booking history (foreign key), so rooms with history are marked inactive instead.

**Possible improvements to mention:** Spring Security with JWT and roles (ADMIN / CUSTOMER), pagination with `Pageable`, payment integration, email confirmation, Docker, and a React or Angular front end.
