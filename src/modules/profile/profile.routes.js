import express from "express";
import { getUserProfile, updateUserProfile } from "./profile.controller.js";

const router = express.Router();

router.get("/:userId", getUserProfile);
router.patch("/", updateUserProfile);

export default router;
