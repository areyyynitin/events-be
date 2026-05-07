import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { signupSchema, signinSchema } from "../schemas";
import { User } from "../models/Event";

const router = Router();
const formatValidationError = (error: any) => {
    const issues = error?.issues;
    if (Array.isArray(issues) && issues.length > 0) {
        return issues
            .map((issue: any) => `${issue.path?.join(".") || "field"}: ${issue.message}`)
            .join(", ");
    }
    return "Please check the submitted fields.";
};

router.post("/signup", async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: `${formatValidationError(parsed.error)}`,
        });
    }

    const { email, password } = parsed.data;

    try {
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            email,
            password: hashedPassword,
        });

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET!,
            { expiresIn: "7d" }
        );

        res.json({ token });
    } catch {
        res.status(500).json({ message: "Unable to complete signup right now. Please try again." });
    }
});

router.post("/signin", async (req, res) => {
    const parsed = signinSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: ` ${formatValidationError(parsed.error)}`,
        });
    }

    const { email, password } = parsed.data;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        if (!user.password) {
            return res.status(500).json({ message: "User password missing" });
        }
        const isMatch = await bcrypt.compare(password, user.password as string);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET!,
            { expiresIn: "7d" }
        );

        res.json({ token });
    } catch {
        res.status(500).json({ message: "Unable to login right now. Please try again." });
    }
});

export default router;