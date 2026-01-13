import express from "express";
import {
    requestOtp,
    verifyOtp,
    verifySession,
} from "./auth.controller.js";

const router = express.Router();

router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.post("/verify-session", verifySession);

export default router;

