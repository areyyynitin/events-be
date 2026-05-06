import { Router } from "express";
import mongoose from "mongoose";
import { reserveSchema, bookingSchema } from "../schemas";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { Reservation, Seat } from "../models/Event";

const router = Router();

const releaseExpiredReservations = async (eventId: string, session?: mongoose.ClientSession) => {
    const now = new Date();
    const reservationQuery = Reservation.find({
        eventId,
        expiresAt: { $lte: now },
    });
    if (session) reservationQuery.session(session);
    const expiredReservations = await reservationQuery;

    if (expiredReservations.length === 0) return;

    const reservedSeats = expiredReservations.flatMap((reservation) => reservation.seatNumbers);
    if (reservedSeats.length > 0) {
        const seatUpdate = Seat.updateMany(
            {
                eventId,
                seatNumber: { $in: reservedSeats },
                status: "reserved",
            },
            { $set: { status: "available", reservedUntil: null } }
        );
        if (session) seatUpdate.session(session);
        await seatUpdate;
    }

    const deleteQuery = Reservation.deleteMany({
        _id: { $in: expiredReservations.map((reservation) => reservation._id) },
    });
    if (session) deleteQuery.session(session);
    await deleteQuery;
};

router.post("/reserve", authMiddleware, async (req: AuthRequest, res) => {
    const parsed = reserveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);

    const { eventId, seatNumbers } = parsed.data;
    const userId = req.userId!;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await releaseExpiredReservations(eventId, session);

        const seats = await Seat.find({
            eventId,
            seatNumber: { $in: seatNumbers },
            status: "available",
        }).session(session);

        if (seats.length !== seatNumbers.length) {
            throw new Error("Some seats not available");
        }

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await Seat.updateMany(
            { eventId, seatNumber: { $in: seatNumbers } },
            {
                $set: {
                    status: "reserved",
                    reservedUntil: expiresAt,
                },
            },
            { session }
        );

        const reservation = await Reservation.create(
            [
                {
                    userId,
                    eventId,
                    seatNumbers,
                    expiresAt,
                },
            ],
            { session }
        );

        await session.commitTransaction();
        res.json(reservation[0]);
    } catch (err: any) {
        await session.abortTransaction();
        const message = err?.message || "Reservation failed";
        res.status(400).json({ message });
    } finally {
        session.endSession();
    }
});

router.post("/bookings", authMiddleware, async (req: AuthRequest, res) => {
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
  
    const { eventId } = parsed.data;
    const userId = req.userId!;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await releaseExpiredReservations(eventId, session);

        const reservation = await Reservation.findOne({
            userId,
            eventId,
        }).session(session);

        if (!reservation) throw new Error("No reservation found");



        if (!reservation.expiresAt) {
            throw new Error("Reservation missing expiration");
        }
        if (reservation.expiresAt < new Date()) {
            throw new Error("Reservation expired");
        }

        await Seat.updateMany(
            {
                eventId,
                seatNumber: { $in: reservation.seatNumbers },
                status: "reserved",
            },
            {
                $set: {
                    status: "booked",
                    reservedUntil: null,
                },
            },
            { session }
        );
        const updatedSeats = await Seat.countDocuments({
            eventId,
            seatNumber: { $in: reservation.seatNumbers },
            status: "booked",
        }).session(session);
        if (updatedSeats !== reservation.seatNumbers.length) {
            throw new Error("Some seats are no longer reservable");
        }

        await Reservation.deleteOne({ _id: reservation._id }).session(session);

        await session.commitTransaction();

        res.json({ message: "Booking successful" });
    } catch (err: any) {
        await session.abortTransaction();
        const message = err?.message || "Booking failed";
        res.status(400).json({ message });
    } finally {
        session.endSession();
    }
});

export default router;