import express from "express";
import * as sportController from "./sport.controller.js";

const router = express.Router();

/* =====================
   SPORT CRUD
   ===================== */

// POST /api/sports
router.post("/", sportController.createSport);

// GET /api/sports
router.get("/", sportController.listSports);

// GET /api/sports/:id
router.get("/:id", sportController.getSportById);

// PUT /api/sports/:id
router.put("/:id", sportController.updateSport);

// DELETE /api/sports/:id
router.delete("/:id", sportController.deleteSport);

export default router;
