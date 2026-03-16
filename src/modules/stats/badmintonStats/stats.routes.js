import { Router } from "express";
import * as statsController from "./stats.controller.js";

const router = Router({ mergeParams: true });

// GET /stats/badminton/:userId/overview
router.get("/badminton/:userId/overview", statsController.getBadmintonOverview);

// GET /stats/badminton/:userId/singles
router.get("/badminton/:userId/singles", statsController.getBadmintonSingles);

// GET /stats/badminton/:userId/doubles
router.get("/badminton/:userId/doubles", statsController.getBadmintonDoubles);

// GET /stats/badminton/:userId/history
router.get("/badminton/:userId/history", statsController.getMatchHistory);

// GET /stats/badminton/:userId/achievements
router.get("/badminton/:userId/achievements", statsController.getAchievements);

// GET /stats/badminton/:userId/streaks
router.get("/badminton/:userId/streaks", statsController.getActiveStreaks);

// GET /stats/badminton/:userId/courts
router.get("/badminton/:userId/courts", statsController.getCourtStats);

// 🆕 NEW: GET /stats/badminton/:userId/all
router.get("/badminton/:userId/all", statsController.getAllBadmintonStats);

export default router;