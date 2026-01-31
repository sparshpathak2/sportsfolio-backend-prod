import express from "express";
import {
   invite,
   acceptInvitation,
   listInvitationsByUserId,
   listInvitationsByTargetId,
   deleteInvitation,
} from "./invitation.controller.js";

const router = express.Router({ mergeParams: true });

/* =====================
   CREATE INVITATION
   ===================== */
// POST /api/tournaments/:tournamentId/invitations
// POST /api/matches/:matchId/invitations
router.post("/", invite);

/* =====================
   LIST INVITATIONS
   ===================== */
// GET /api/tournaments/:tournamentId/invitations
// GET /api/matches/:matchId/invitations
// GET /api/users/:userId/invitations
router.get("/", (req, res, next) => {
   // const { tournamentId, matchId } = req.query;
   const { tournamentId, matchId } = req.params;

   if (tournamentId || matchId) {
      return listInvitationsByTargetId(req, res, next);
   }

   return listInvitationsByUserId(req, res, next);
});


/* =====================
   ACCEPT INVITATION
   ===================== */
// POST /api/tournaments/:tournamentId/invitations/:invitationId/accept
// POST /api/matches/:matchId/invitations/:invitationId/accept
router.post("/:invitationId/accept", acceptInvitation);

/* =====================
   DELETE INVITATION
   ===================== */
// DELETE /api/tournaments/:tournamentId/invitations/:invitationId
// DELETE /api/matches/:matchId/invitations/:invitationId
router.delete("/:invitationId", deleteInvitation);

export default router;
