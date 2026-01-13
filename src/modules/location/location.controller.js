import * as locationService from "./location.service.js";

export const createLocation = async (req, res) => {
    try {
        const location = await locationService.createLocation(req.body);
        return res.status(201).json({
            success: true,
            data: location,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
        });
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
        return res.status(500).json({
            success: false,
            message: error.message,
        });
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
        return res.status(404).json({
            success: false,
            message: error.message,
        });
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
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
