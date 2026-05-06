import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true,
    },
    password: { type: String, required: true },
});

export const User = mongoose.model("User", userSchema);

const eventSchema = new mongoose.Schema({
    name: String,
    dateTime: Date,
    venue: String,
    totalSeats: Number,
});

export const Event = mongoose.model("Event", eventSchema);


export type SeatStatus = "available" | "reserved" | "booked";

const seatSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
    },
    seatNumber: Number,
    status: {
        type: String,
        enum: ["available", "reserved", "booked"],
        default: "available",
    },
    reservedUntil: Date,
});

seatSchema.index({ eventId: 1, seatNumber: 1 }, { unique: true });

export const Seat = mongoose.model("Seat", seatSchema);


const reservationSchema = new mongoose.Schema({
    userId: String,
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
    },
    seatNumbers: [Number],
    expiresAt: Date,
});

reservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Reservation = mongoose.model("Reservation", reservationSchema);