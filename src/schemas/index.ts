import { z } from "zod";

// Event
export const createEventSchema = z.object({
    name: z.string().min(1),
    dateTime: z.string().datetime(),
    venue: z.string(),
    totalSeats: z.number().int().positive(),
});

// Reserve Seats
export const reserveSchema = z.object({
    eventId: z.string(),
    seatNumbers: z.array(z.number().int().positive()).min(1),
});

// Booking
export const bookingSchema = z.object({
    eventId: z.string(),
});


export const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

export const signinSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});