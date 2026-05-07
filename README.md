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
