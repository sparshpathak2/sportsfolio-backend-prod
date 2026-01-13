import { Router } from "express";
import * as userController from "./user.controller.js";
import invitationRoutes from "../invitation/invitation.routes.js"

const router = Router();

// router.post("/", userController.createUser);
router.get("/", userController.listUsers);
router.get("/:id", userController.getUserById);
router.put("/:id", userController.updateUser);

// ✅ User → Invitations
router.use("/:userId/invitations", invitationRoutes);

export default router;
