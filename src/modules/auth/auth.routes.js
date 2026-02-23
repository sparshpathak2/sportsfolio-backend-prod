import express from "express";
import {
    requestOtp,
    verifyFirebaseToken,
    verifyOtp,
    verifySession,
} from "./auth.controller.js";

const router = express.Router();

router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.post("/verify-session", verifySession);
router.post("/verify-token", verifyFirebaseToken);

export default router;

