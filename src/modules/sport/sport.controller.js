import * as sportService from "./sport.service.js";

export const createSport = async (req, res) => {
    try {
        const { code, name } = req.body;

        if (!code || !name) {
            return res.status(400).json({
                message: "CODE_AND_NAME_REQUIRED",
            });
        }

        const sport = await sportService.createSport({ code, name });

        res.status(201).json({
            success: true,
            data: sport,
        });
    } catch (error) {
        console.error("Create Sport Error:", error);
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const listSports = async (req, res) => {
    try {
        const sports = await sportService.listSports();

        res.json({
            success: true,
            data: sports,
        });
    } catch (error) {
        console.error("List Sports Error:", error);
        res.status(500).json({
            success: false,
            message: "FAILED_TO_LIST_SPORTS",
        });
    }
};

export const getSportById = async (req, res) => {
    try {
        const { id } = req.params;

        const sport = await sportService.getSportById(id);

        if (!sport) {
            return res.status(404).json({
                message: "SPORT_NOT_FOUND",
            });
        }

        res.json({
            success: true,
            data: sport,
        });
    } catch (error) {
        console.error("Get Sport Error:", error);
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const updateSport = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const sport = await sportService.updateSport(id, { name });

        res.json({
            success: true,
            data: sport,
        });
    } catch (error) {
        console.error("Update Sport Error:", error);
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const deleteSport = async (req, res) => {
    try {
        const { id } = req.params;

        await sportService.deleteSport(id);

        res.json({
            success: true,
            message: "SPORT_DELETED",
        });
    } catch (error) {
        console.error("Delete Sport Error:", error);
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
