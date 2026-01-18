import express from "express";
import multer from "multer";
import * as tournamentController from "./tournament.controller.js";

import participantRoutes from "../participant/participant.routes.js";
import invitationRoutes from "../invitation/invitation.routes.js";
import matchRoutes from "../match/match.routes.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* =====================
   TOURNAMENT CRUD
   ===================== */
router.post("/", tournamentController.createTournament);

router.get("/", tournamentController.listTournaments);
router.get("/my", tournamentController.getMyTournaments);
router.get("/public", tournamentController.getPublicTournaments);
router.get("/:tournamentId", tournamentController.getTournament);
router.put("/:tournamentId", tournamentController.updateTournament);
router.delete("/:tournamentId", tournamentController.deleteTournament);

/* =====================
   JOIN TOURNAMENT
   ===================== */
// router.post("/:tournamentId/join", tournamentController.joinTournament);

/* =====================
   TOURNAMENT RULES
   ===================== */
router.post("/:tournamentId/rules", tournamentController.upsertTournamentRules);

/* =====================
   TOURNAMENT INVITATIONS
   ===================== */
router.use("/:tournamentId/invitations", invitationRoutes);

/* =====================
   TOURNAMENT PARTICIPANTS
   ===================== */
router.use("/:tournamentId/participants", participantRoutes);

/* =====================
   TOURNAMENT MATCHES
   ===================== */
router.use("/:tournamentId/matches", matchRoutes);

router.post("/:tournamentId/matchmaking", tournamentController.runMatchmaking);

router.post("/:tournamentId/rounds/next ", tournamentController.advanceTournamentRound);


export default router;
