import express from "express";
import { upload } from "./asset.upload.js";
import * as controller from "./asset.controller.js";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create MRI request (doctor / admin)
// router.post("/", createMRIRequest);

router.post(
    "/",
    upload.fields([
        { name: "prescriptions", maxCount: 10 },
        { name: "reports", maxCount: 10 },
    ]),
    createMRIRequest
);

export default router;
