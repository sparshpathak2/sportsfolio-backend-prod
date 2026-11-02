// import * as locationService from "./location.service.js";

// export const createLocation = async (req, res) => {
//     try {
//         const location = await locationService.createLocation(req.body);
//         return res.status(201).json({
//             success: true,
//             data: location,
//         });
//     } catch (error) {
//         return res.status(400).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

// export const listLocations = async (req, res) => {
//     try {
//         const locations = await locationService.listLocations();
//         return res.json({
//             success: true,
//             data: locations,
//         });
//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

// export const getLocationById = async (req, res) => {
//     try {
//         const location = await locationService.getLocationById(req.params.id);
//         return res.json({
//             success: true,
//             data: location,
//         });
//     } catch (error) {
//         return res.status(404).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };

// export const updateLocation = async (req, res) => {
//     try {
//         const location = await locationService.updateLocation(
//             req.params.id,
//             req.body
//         );
//         return res.json({
//             success: true,
//             data: location,
//         });
//     } catch (error) {
//         return res.status(400).json({
//             success: false,
//             message: error.message,
//         });
//     }
// };


// // 🆕 Get flat list of cities, optional search query
// export const getCities = (req, res) => {
//     try {
//         const allCities = [
//             "Ahmedabad",
//             "Agra",
//             "Amritsar",
//             "Bengaluru",
//             "Bhopal",
//             "Bhubaneswar",
//             "Chandigarh",
//             "Chennai",
//             "Coimbatore",
//             "Delhi",
//             "Faridabad",
//             "Ghaziabad",
//             "Hyderabad",
//             "Indore",
//             "Jaipur",
//             "Kanpur",
//             "Kolkata",
//             "Lucknow",
//             "Mumbai",
//             "Nagpur",
//             "Noida",
//             "Patna",
//             "Pune",
//             "Raipur",
//             "Ranchi",
//             "Surat",
//             "Vadodara",
//             "Visakhapatnam"
//         ];

//         const query = req.query.query?.toLowerCase();

//         const filteredCities = query
//             ? allCities.filter(city => city.toLowerCase().includes(query))
//             : allCities;

//         res.json({
//             success: true,
//             data: filteredCities,
//         });
//     } catch (error) {
//         console.error("Get Cities Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch cities",
//         });
//     }
// };


import * as locationService from "./location.service.js";
import { logger } from "../../lib/logger.js";

// Known service error codes mapped to HTTP status
const KNOWN_ERRORS = {
    LOCATION_NAME_AND_ADDRESS_REQUIRED: 400,
    LOCATION_ALREADY_EXISTS: 400,
    INVALID_COORDINATES: 400,
    INVALID_RADIUS: 400,
    LOCATION_NOT_FOUND: 404,
};

// Known errors return their code; anything unexpected is logged and returns a generic 500
const sendError = (res, error, context) => {
    const status = KNOWN_ERRORS[error.message];
    if (status) {
        return res.status(status).json({ success: false, message: error.message });
    }
    logger.error({ err: error }, `${context} failed`);
    return res.status(500).json({ success: false, message: "Internal server error" });
};

export const createLocation = async (req, res) => {
    try {
        const location = await locationService.createLocation(req.body);
        return res.status(201).json({
            success: true,
            data: location,
        });
    } catch (error) {
        return sendError(res, error, "Create location");
    }
};

export const listLocations = async (req, res) => {
    try {
        const locations = await locationService.listLocations();
        return res.json({
            success: true,
            data: locations,
        });
    } catch (error) {
        return sendError(res, error, "List locations");
    }
};

// 🆕 GET /api/locations/nearby?latitude=..&longitude=..&radiusKm=10&limit=50
export const getNearbyLocations = async (req, res) => {
    try {
        const { latitude, longitude, radiusKm, limit } = req.query;
        const locations = await locationService.findNearbyLocations({
            latitude,
            longitude,
            radiusKm,
            limit,
        });
        return res.json({
            success: true,
            data: locations,
        });
    } catch (error) {
        return sendError(res, error, "Nearby locations");
    }
};

export const getLocationById = async (req, res) => {
    try {
        const location = await locationService.getLocationById(req.params.id);
        return res.json({
            success: true,
            data: location,
        });
    } catch (error) {
        return sendError(res, error, "Get location");
    }
};

export const updateLocation = async (req, res) => {
    try {
        const location = await locationService.updateLocation(
            req.params.id,
            req.body
        );
        return res.json({
            success: true,
            data: location,
        });
    } catch (error) {
        return sendError(res, error, "Update location");
    }
};

// 🆕 Get flat list of cities, optional search query
export const getCities = (req, res) => {
    try {
        const allCities = [
            "Ahmedabad",
            "Agra",
            "Amritsar",
            "Bengaluru",
            "Bhopal",
            "Bhubaneswar",
            "Chandigarh",
            "Chennai",
            "Coimbatore",
            "Delhi",
            "Faridabad",
            "Ghaziabad",
            "Hyderabad",
            "Indore",
            "Jaipur",
            "Kanpur",
            "Kolkata",
            "Lucknow",
            "Mumbai",
            "Nagpur",
            "Noida",
            "Patna",
            "Pune",
            "Raipur",
            "Ranchi",
            "Surat",
            "Vadodara",
            "Visakhapatnam"
        ];

        const query = req.query.query?.toLowerCase();

        const filteredCities = query
            ? allCities.filter(city => city.toLowerCase().includes(query))
            : allCities;

        res.json({
            success: true,
            data: filteredCities,
        });
    } catch (error) {
        logger.error({ err: error }, "Get cities failed");
        res.status(500).json({
            success: false,
            message: "Failed to fetch cities",
        });
    }
};