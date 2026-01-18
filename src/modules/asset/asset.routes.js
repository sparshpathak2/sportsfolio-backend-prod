
import express from "express";
import upload from "./asset.upload.js";
import { uploadImage } from "./asset.controller.js";

const router = express.Router();

// POST /api/assets/upload (single image)
router.post("/upload", upload.single("image"), uploadImage);

export default router;
