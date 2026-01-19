import { Router } from "express";
import * as RequestController from "./request.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

// Apply auth to all request routes
router.use(authMiddleware);

// Send a request to join a tournament
router.post("/", RequestController.createTournamentRequest);

// Get my sent requests
router.get("/my-requests", RequestController.getMyRequests);

// List requests for a specific tournament (Organizer only)
router.get("/tournament/:tournamentId", RequestController.getTournamentRequests);

// Respond to a request (Accept/Reject - Organizer only)
router.patch("/:requestId/respond", RequestController.respondToRequest);

export default router;
