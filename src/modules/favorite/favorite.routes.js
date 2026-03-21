import { Router } from "express";
import * as favoriteController from "./favorite.controller.js";

const router = Router();

// ==================== TEAM FAVORITES ==================== //

// POST /api/favorites/teams
router.post("/teams", favoriteController.addFavoriteTeam);

// GET /api/favorites/teams
router.get("/teams", favoriteController.getFavoriteTeams);

// DELETE /api/favorites/teams/:teamId
router.delete("/teams/:teamId", favoriteController.removeFavoriteTeam);

// ==================== USER FAVORITES ==================== //

// POST /api/favorites/users
router.post("/players", favoriteController.addFavoriteUser);

// GET /api/favorites/users
router.get("/players", favoriteController.getFavoriteUsers);

// DELETE /api/favorites/users/:favoriteUserId
router.delete("/players/:favoriteUserId", favoriteController.removeFavoriteUser);

export default router;