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
        const existingReservations = await Reservation.find({
            eventId,
            userId,
        }).session(session);
        const existingSeatNumbers = [
            ...new Set(existingReservations.flatMap((reservation) => reservation.seatNumbers)),
        ];
        const seatNumbersToReserve = [...new Set([...existingSeatNumbers, ...seatNumbers])];
        const freshSeatNumbers = seatNumbersToReserve.filter(
            (seatNumber) => !existingSeatNumbers.includes(seatNumber)
        );

        if (freshSeatNumbers.length > 0) {
            const seats = await Seat.find({
                eventId,
                seatNumber: { $in: freshSeatNumbers },
                status: "available",
            }).session(session);

            if (seats.length !== freshSeatNumbers.length) {
                throw new Error("Some seats not available");
            }
        }

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await Seat.updateMany(
            { eventId, seatNumber: { $in: seatNumbersToReserve } },
            {
                $set: {
                    status: "reserved",
                    reservedUntil: expiresAt,
                },
            },
            { session }
        );

        if (existingReservations.length > 0) {
            await Reservation.deleteMany({
                _id: { $in: existingReservations.map((reservation) => reservation._id) },
            }).session(session);
        }

        const reservation = await Reservation.create(
            [
                {
                    userId,
                    eventId,
                    seatNumbers: seatNumbersToReserve,
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

router.get("/reservations/:eventId/me", authMiddleware, async (req: AuthRequest, res) => {
    const eventIdParam = req.params.eventId;
    const userId = req.userId!;

    if (typeof eventIdParam !== "string" || eventIdParam.trim().length === 0) {
        return res.status(400).json({ message: "Invalid event id." });
    }
    const eventId = eventIdParam;

    try {
        await releaseExpiredReservations(eventId);
        const reservations = await Reservation.find({ eventId, userId });
        if (reservations.length === 0) {
            return res.json({ seatNumbers: [], expiresAt: null });
        }

        const now = new Date();
        const activeReservations = reservations.filter(
            (reservation) => reservation.expiresAt && reservation.expiresAt >= now
        );
        if (activeReservations.length === 0) {
            return res.json({ seatNumbers: [], expiresAt: null });
        }

        const seatNumbers = [...new Set(activeReservations.flatMap((reservation) => reservation.seatNumbers))];
        const latestExpiry = new Date(
            Math.max(...activeReservations.map((reservation) => new Date(reservation.expiresAt as Date).getTime()))
        );

        return res.json({ seatNumbers, expiresAt: latestExpiry });
    } catch {
        return res
            .status(500)
            .json({ message: "Unable to fetch your active reservation right now. Please try again." });
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

        const reservations = await Reservation.find({
            userId,
            eventId,
        }).session(session);

        if (reservations.length === 0) throw new Error("No reservation found");

        const now = new Date();
        const activeReservations = reservations.filter(
            (reservation) => reservation.expiresAt && reservation.expiresAt >= now
        );
        if (activeReservations.length === 0) {
            throw new Error("Reservation expired");
        }

        const seatNumbers = [...new Set(activeReservations.flatMap((reservation) => reservation.seatNumbers))];
        await Seat.updateMany(
            {
                eventId,
                seatNumber: { $in: seatNumbers },
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
            seatNumber: { $in: seatNumbers },
            status: "booked",
        }).session(session);
        if (updatedSeats !== seatNumbers.length) {
            throw new Error("Some seats are no longer reservable");
        }

        await Reservation.deleteMany({
            _id: { $in: activeReservations.map((reservation) => reservation._id) },
        }).session(session);

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