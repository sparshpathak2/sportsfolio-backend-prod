import { uploadToS3 } from "../../lib/uploadToS3.js";

// POST /api/assets/upload
export const uploadImage = async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ message: "No file uploaded" });
		}

		const { originalname, buffer, mimetype } = req.file;
		const key = `public/${Date.now()}_${originalname}`;

		const url = await uploadToS3({ buffer, key, mimetype });

		return res.status(200).json({
			success: true,
			url,
		});
	} catch (error) {
		console.error("Image upload error:", error);
		return res.status(500).json({
			success: false,
			message: "Failed to upload image",
		});
	}
};
