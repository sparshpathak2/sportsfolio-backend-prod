import { Router } from "express";
import * as locationController from "./location.controller.js";

const router = Router();

router.post("/", locationController.createLocation);
router.get("/", locationController.listLocations);
router.get("/:id", locationController.getLocationById);
router.put("/:id", locationController.updateLocation);

export default router;
