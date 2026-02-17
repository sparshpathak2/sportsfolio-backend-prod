// src/modules/scheduler/scheduler.routes.js
import express from "express";
import { schedulerController } from "./scheduler.controller.js";

const router = express.Router();

// Admin routes to manage scheduler
router.get("/status", schedulerController.getStatus);
router.post("/trigger", schedulerController.triggerNow);
router.post("/stop", schedulerController.stop);
router.post("/start", schedulerController.start);

export default router;