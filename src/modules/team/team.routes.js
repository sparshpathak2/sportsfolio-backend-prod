import express from "express";
import * as teamController from "./team.controller.js";

const router = express.Router();

/* =====================
   TEAM CRUD
   ===================== */

// POST /teams
router.post("/", teamController.createTeam);

// GET /teams?sportId=xxx
router.get("/", teamController.listTeams);

// GET /teams/:id
router.get("/:id", teamController.getTeamById);

/* =====================
   TEAM MEMBERS
   ===================== */

// POST /teams/:id/members
router.post("/:teamId/members", teamController.joinTeamController);

// DELETE /teams/:id/members/:userId
router.delete("/:teamId/members/:userId", teamController.removeTeamMember);

// GET /teams/:id/members
router.get("/:id/members", teamController.listTeamMembers);

export default router;
