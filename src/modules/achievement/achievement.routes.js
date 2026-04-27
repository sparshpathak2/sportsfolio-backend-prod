import { Router } from "express";
import * as achievementController from "./achievement.controller.js";

const router = Router({ mergeParams: true });

// GET /api/achievements/badminton/:userId
router.get("/badminton/:userId", achievementController.getAchievements);

// GET /api/achievements/badminton/:userId/:achievementId/share-card
router.get("/badminton/:userId/:achievementId/share-card", achievementController.getShareCard);

// POST /api/achievements/badminton/:userId/evaluate
router.post("/badminton/:userId/evaluate", achievementController.evaluateAchievements);

export default router;
