import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db/mongoose";
import eventRoutes from "./routes/events";
import bookingRoutes from "./routes/booking";
import cors from "cors"
import authRoutes from "./routes/auth";

dotenv.config();

const app = express();
app.use(express.json());
app.use(
    cors({
        origin: process.env.FRONTEND_URL! as string,
        credentials: true,
    })
);

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api", bookingRoutes);

const start = async () => {
    await connectDB();

    app.listen(3000, () => {
        console.log("Server running on port 3000");
    });
};

start();