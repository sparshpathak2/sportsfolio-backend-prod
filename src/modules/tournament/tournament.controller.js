import * as tournamentService from "./tournament.service.js";

// export const createTournament = async (req, res) => {
//     try {
//         const {
//             name,
//             sportCode,
//             tournamentType,
//             startDate,
//             endDate,
//             scheduleType,
//             isPublic,
//             entryFee,
//             location,        // ✅ SINGLE OBJECT
//             rules,
//             reportingSlots,
//             matchMakingAt,   // ✅ NEW
//         } = req.body;

//         if (!name || !sportCode || !tournamentType || !startDate || !location) {
//             return res.status(400).json({
//                 success: false,
//                 message: "name, sportCode, tournamentType, startDate, location are required",
//             });
//         }

//         const tournament = await tournamentService.createTournament({
//             name,
//             sportCode,
//             tournamentType,
//             startDate,
//             endDate,
//             scheduleType,
//             isPublic,
//             entryFee,
//             location,        // ✅ PASS AS-IS
//             rules,
//             reportingSlots,
//             matchMakingAt,   // ✅ PASS AS-IS
//         });

//         return res.status(201).json({
//             success: true,
//             data: tournament,
//         });
//     } catch (error) {
//         console.error(error);
//         return res.status(400).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

// export const createTournament = async (req, res) => {
//     try {
//         const {
//             name,
//             sportCode,
//             tournamentType,
//             startDate,
//             endDate,
//             scheduleType,
//             isPublic,
//             entryFee,
//             matchMakingAt,
//         } = req.body;

//         if (!name || !sportCode || !tournamentType || !startDate) {
//             return res.status(400).json({
//                 success: false,
//                 message: "name, sportCode, tournamentType, startDate are required",
//             });
//         }

//         // ✅ Parse nested JSON fields
//         const location = req.body.location
//             ? JSON.parse(req.body.location)
//             : null;

//         const rules = req.body.rules
//             ? JSON.parse(req.body.rules)
//             : null;

//         const reportingSlots = req.body.reportingSlots
//             ? JSON.parse(req.body.reportingSlots)
//             : [];

//         if (!location) {
//             return res.status(400).json({
//                 success: false,
//                 message: "location is required",
//             });
//         }

//         // ✅ Extract files
//         const logo = req.files?.logo?.[0] || null;
//         const banner = req.files?.banner?.[0] || null;

//         const tournament = await tournamentService.createTournament({
//             name,
//             sportCode,
//             tournamentType,
//             startDate,
//             endDate,
//             scheduleType,
//             isPublic,
//             entryFee,
//             location,
//             rules,
//             reportingSlots,
//             matchMakingAt,
//             logo,    // 👈 PASS FILE
//             banner,  // 👈 PASS FILE
//         });

//         return res.status(201).json({
//             success: true,
//             data: tournament,
//         });
//     } catch (error) {
//         console.error("Create Tournament Error:", error);
//         return res.status(400).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

// controller

const parseIfString = (value) => {
    if (!value) return null;
    if (typeof value === "string") return JSON.parse(value);
    return value;
};


export const createTournament = async (req, res) => {
    try {
        const {
            name,
            sportCode,
            tournamentType,
            startDate,
            endDate,
            scheduleType,
            isPublic,
            entryFee,
            matchMakingAt,
            city,
        } = req.body;

        if (!name || !sportCode || !tournamentType || !startDate) {
            return res.status(400).json({
                success: false,
                message: "name, sportCode, tournamentType, startDate are required",
            });
        }

        // const location = req.body.location ? JSON.parse(req.body.location) : null;
        // const rules = req.body.rules ? JSON.parse(req.body.rules) : null;
        // const reportingSlots = req.body.reportingSlots
        //     ? JSON.parse(req.body.reportingSlots)
        //     : [];

        const location = parseIfString(req.body.location);
        const locations = parseIfString(req.body.locations) || (location ? [location] : []);
        const rules = parseIfString(req.body.rules);
        const reportingSlots = parseIfString(req.body.reportingSlots) || [];

        if (!locations.length) {
            return res.status(400).json({
                success: false,
                message: "At least one location is required",
            });
        }

        const logoUrl = req.body.logo || null;
        const bannerUrl = req.body.banner || null;

        const tournament = await tournamentService.createTournament({
            name,
            sportCode,
            tournamentType,
            startDate,
            endDate,
            scheduleType,
            isPublic,
            entryFee,
            matchMakingAt,
            locations,
            rules,
            reportingSlots,
            logoUrl,
            bannerUrl,
            city,
            organizerId: req.user.id,
        });

        return res.status(201).json({
            success: true,
            data: tournament,
        });
    } catch (error) {
        console.error("Create Tournament Error:", error);
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};



export const listTournaments = async (req, res) => {
    // console.log("req.header at listTournaments:", req.headers)
    try {
        const tournaments = await tournamentService.listTournaments(req.user?.id);
        res.json({ success: true, data: tournaments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getMyTournaments = async (req, res) => {
    try {
        const tournaments = await tournamentService.getMyTournaments(req.user.id);
        res.json({
            success: true,
            data: tournaments,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getPublicTournaments = async (req, res) => {
    try {
        const tournaments = await tournamentService.getPublicTournaments(req.user?.id);
        res.json({
            success: true,
            data: tournaments,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getTournament = async (req, res) => {
    try {
        const tournament = await tournamentService.getTournament(
            req.params.tournamentId,
            req.user?.id
        );

        res.json({
            success: true,
            message: "Tournament fetched successfully",
            data: tournament,
        });
    } catch (error) {
        const map = {
            TOURNAMENT_NOT_FOUND: [404, "Tournament not found"],
        };

        const [status, message] = map[error.message] || [
            500,
            "Failed to fetch tournament",
        ];

        res.status(status).json({
            success: false,
            message,
        });
    }
};


export const updateTournament = async (req, res) => {
    try {
        const updated = await tournamentService.updateTournament(
            req.params.tournamentId,
            req.body
        );

        res.json({
            success: true,
            message: "Tournament updated successfully",
            data: updated,
        });
    } catch (error) {
        const map = {
            TOURNAMENT_NOT_FOUND: [404, "Tournament not found"],
            TOURNAMENT_LOCKED: [409, "Tournament can no longer be modified"],
            INVALID_DATE_RANGE: [400, "Invalid date range"],
        };

        const [status, message] = map[error.message] || [
            400,
            "Failed to update tournament",
        ];

        res.status(status).json({ success: false, message });
    }
};


export const deleteTournament = async (req, res) => {
    try {
        await tournamentService.deleteTournament(req.params.tournamentId);

        res.json({
            success: true,
            message: "Tournament deleted successfully",
        });
    } catch (error) {
        const map = {
            TOURNAMENT_NOT_FOUND: [404, "Tournament not found"],
            TOURNAMENT_CANNOT_BE_DELETED: [
                409,
                "Only draft tournaments can be deleted",
            ],
        };

        const [status, message] = map[error.message] || [
            400,
            "Failed to delete tournament",
        ];

        res.status(status).json({
            success: false,
            message,
        });
    }
};

export const upsertTournamentRules = async (req, res) => {
    try {
        const rules = await tournamentService.upsertTournamentRules(
            req.params.id,
            req.body
        );

        res.json({
            success: true,
            message: "Tournament rules saved successfully",
            data: rules,
        });
    } catch (error) {
        const map = {
            TOURNAMENT_NOT_FOUND: [404, "Tournament not found"],
        };

        const [status, message] = map[error.message] || [
            400,
            "Failed to save tournament rules",
        ];

        res.status(status).json({
            success: false,
            message,
        });
    }
};

export const runMatchmaking = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        const result = await tournamentService.runMatchmaking(tournamentId);

        return res.json({ success: true, data: result });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

export const advanceTournamentRound = async (req, res) => {
    try {
        const { tournamentId } = req.params;

        const result = await tournamentService.advanceRound(tournamentId);

        return res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
