// stats.routes.js
import { Router } from "express";
import * as statsController from "./stats.controller.js";

const router = Router();

// GET /stats/user/:userId/sport/:sportCode
router.get("/user/:userId/sport/:sportCode", statsController.getPlayerStats);

// GET /stats/user/:userId/all
router.get("/user/:userId/all", statsController.getAllPlayerStats);

export default router;