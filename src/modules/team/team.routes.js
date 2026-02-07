import express from "express";
import * as teamController from "./team.controller.js";
import invitationRoutes from "../invitation/invitation.routes.js";

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

// PUT /teams/:id   ✅ ADD IT HERE
router.put("/:id", teamController.updateTeam);

// DELETE /teams/:id   ✅ DELETE TEAM
router.delete("/:id", teamController.deleteTeam);

/* =====================
   TEAM INVITATIONS
   ===================== */

// POST   /teams/:teamId/invitations
// GET    /teams/:teamId/invitations
// POST   /teams/:teamId/invitations/:invitationId/accept
// DELETE /teams/:teamId/invitations/:invitationId
router.use("/:teamId/invitations", invitationRoutes);

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
