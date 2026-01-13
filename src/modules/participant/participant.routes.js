import express from "express";
import {
    addParticipant,
    listParticipants,
    removeParticipant,
    joinTournamentDirect,
    joinTournamentWithCode
} from "./participant.controller.js";

const router = express.Router({ mergeParams: true });

router.post("/", addParticipant);
router.get("/:tournamentId", listParticipants);
router.delete("/:id", removeParticipant);


// Join via public code
router.post("/join/:joinCode", joinTournamentWithCode);

// Join via logged-in button click
router.post("/join/", joinTournamentDirect);

export default router;
