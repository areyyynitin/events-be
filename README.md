# Event Booking Backend (Node.js + Express + MongoDB)

Backend service for managing events, seat reservations, and bookings. Implements atomic operations to prevent double booking.

---

## Features

* User authentication (JWT)
* Event management
* Seat-level reservation system
* Booking confirmation
* Reservation expiration using TTL
* MongoDB transactions for consistency

---

## Tech Stack

* Node.js
* Express.js
* TypeScript
* MongoDB (Mongoose)
* Zod (validation)
* JWT (authentication)
* bcrypt (password hashing)

---

## Project Structure

```
src/
├── models/
│   ├── User.ts
│   ├── Event.ts
│   ├── Seat.ts
│   └── Reservation.ts
├── routes/
│   ├── auth.ts
│   ├── events.ts
│   └── booking.ts
├── middleware/
│   └── auth.ts
├── schemas/
│   └── index.ts
├── db/
│   └── mongoose.ts
└── index.ts
```

---

## Setup

### Install dependencies

```
npm install
```

### Environment variables

Create a `.env` file:

```
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret_key
```

---

### Run server

```
npm run dev
```

Server runs on:

```
http://localhost:3000
```

---

## API Endpoints

### Auth

* POST /api/auth/signup
* POST /api/auth/signin

### Events

* GET /api/events
* GET /api/events/:id

### Booking

* POST /api/reserve
* POST /api/bookings

---

## Data Models

### Event

* name
* dateTime
* venue
* totalSeats

### Seat

* eventId
* seatNumber
* status (available, reserved, booked)
* reservedUntil

### Reservation

* userId
* eventId
* seatNumbers
* expiresAt

---

## Key Concepts

### Prevent Double Booking

* MongoDB transactions
* Seat status checked and updated atomically

### Reservation Expiry

* TTL index on expiresAt
* Automatically removes expired reservations

### Booking Validation

* Ensures reservation exists
* Checks expiration before confirming

---

## Scripts

### Seed seats

Create seats for events:

```
npx ts-node src/scripts/seedSeats.ts
```

---

## Improvements

* Add Redis for distributed locking
* Add payment integration
* Add role-based access (admin)
* Add rate limiting
* Add logging and monitoring

---
