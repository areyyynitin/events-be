import { Router } from "express";
import { Event, Reservation, Seat } from "../models/Event";

const router = Router();

const releaseExpiredReservations = async (eventId: string) => {
    const now = new Date();
    const expiredReservations = await Reservation.find({
        eventId,
        expiresAt: { $lte: now },
    });

    if (expiredReservations.length === 0) return;

    const reservedSeats = expiredReservations.flatMap((reservation) => reservation.seatNumbers);
    if (reservedSeats.length > 0) {
        await Seat.updateMany(
            {
                eventId,
                seatNumber: { $in: reservedSeats },
                status: "reserved",
            },
            { $set: { status: "available", reservedUntil: null } }
        );
    }

    await Reservation.deleteMany({ _id: { $in: expiredReservations.map((r) => r._id) } });
};

const ensureSeatsExist = async (eventId: string, totalSeats: number) => {
    const existingCount = await Seat.countDocuments({ eventId });
    if (existingCount >= totalSeats) return;

    const existingSeats = await Seat.find({ eventId }, { seatNumber: 1 });
    const existingSeatNumbers = new Set(existingSeats.map((seat) => seat.seatNumber));
    const missingSeats = [];

    for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber += 1) {
        if (!existingSeatNumbers.has(seatNumber)) {
            missingSeats.push({ eventId, seatNumber, status: "available", reservedUntil: null });
        }
    }

    if (missingSeats.length > 0) {
        await Seat.insertMany(missingSeats, { ordered: false }).catch(() => {
            // Ignore duplicate key races if multiple requests initialize seats together.
        });
    }
};

// GET all events
router.get("/", async (_, res) => {
    const events = await Event.find();
    res.json(events);
});

// GET single event
router.get("/:id", async (req, res) => {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Not found" });

    const eventId = req.params.id;
    const existingCount = await Seat.countDocuments({ eventId });
    const normalizedTotalSeats =
        typeof event.totalSeats === "number" && event.totalSeats > 0
            ? event.totalSeats
            : existingCount > 0
              ? existingCount
              : 40;

    if (!event.totalSeats || event.totalSeats <= 0) {
        event.totalSeats = normalizedTotalSeats;
        await event.save();
    }

    await ensureSeatsExist(eventId, normalizedTotalSeats);
    await releaseExpiredReservations(eventId);

    const seats = await Seat.find({ eventId }).sort({ seatNumber: 1 });
    res.json({ ...event.toObject(), seats });
});

export default router;