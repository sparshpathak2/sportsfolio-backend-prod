import { Router } from "express";
import * as personnelController from "./personnel.controller.js";

const router = Router();

// ==================== GLOBAL PERSONNEL ENDPOINTS ==================== //

// GET /api/available - Get personnel for dropdown
router.get("/available", personnelController.getAvailablePersonnel);

// ==================== TOURNAMENT PERSONNEL ==================== //

// POST /api/tournaments/:tournamentId/personnel
router.post("/tournaments/:tournamentId/personnel", personnelController.addTournamentPersonnel);

// GET /api/tournaments/:tournamentId/personnel
router.get("/tournaments/:tournamentId/personnel", personnelController.getTournamentPersonnel);

// PUT /api/tournaments/:tournamentId/personnel/:userId
router.put("/tournaments/:tournamentId/personnel/:userId", personnelController.updateTournamentPersonnel);

// DELETE /api/tournaments/:tournamentId/personnel/:userId
router.delete("/tournaments/:tournamentId/personnel/:userId", personnelController.removeTournamentPersonnel);

// ==================== MATCH PERSONNEL ==================== //

// POST /api/matches/:matchId/personnel
router.post("/matches/:matchId/personnel", personnelController.addMatchPersonnel);

// GET /api/matches/:matchId/personnel
router.get("/matches/:matchId/personnel", personnelController.getMatchPersonnel);

// PUT /api/matches/:matchId/personnel/:userId
router.put("/matches/:matchId/personnel/:userId", personnelController.updateMatchPersonnel);

// DELETE /api/matches/:matchId/personnel/:userId
router.delete("/matches/:matchId/personnel/:userId", personnelController.removeMatchPersonnel);

// ==================== USER PERSONNEL ASSIGNMENTS ==================== //

// GET /api/users/:userId/personnel
router.get("/users/:userId/personnel", personnelController.getUserPersonnelAssignments);

// GET /api/users/:userId/personnel/matches
router.get("/users/:userId/personnel/matches", personnelController.getUserMatchesAsPersonnel);

export default router;