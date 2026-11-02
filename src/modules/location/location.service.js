// import prisma from "../../lib/prisma.js";

// export const createLocation = async ({
//     name,
//     address,
//     city,
//     state,
//     country,
//     zipCode,
// }) => {
//     // ✅ Correct validation
//     if (!name || !address) {
//         throw new Error("LOCATION_NAME_AND_ADDRESS_REQUIRED");
//     }

//     try {
//         return await prisma.location.create({
//             data: {
//                 name,
//                 address,
//                 city: city ?? null,
//                 state: state ?? null,
//                 country: country ?? "India",
//                 zipCode: zipCode ?? null,
//             },
//         });
//     } catch (error) {
//         // ✅ Handle unique constraint
//         if (error.code === "P2002") {
//             throw new Error("LOCATION_ALREADY_EXISTS");
//         }
//         throw error;
//     }
// };

// export const listLocations = async () => {
//     return prisma.location.findMany({
//         orderBy: { createdAt: "desc" },
//     });
// };

// export const getLocationById = async (id) => {
//     const location = await prisma.location.findUnique({
//         where: { id },
//     });

//     if (!location) {
//         throw new Error("LOCATION_NOT_FOUND");
//     }

//     return location;
// };

// export const updateLocation = async (id, data) => {
//     try {
//         return await prisma.location.update({
//             where: { id },
//             data: {
//                 name: data.name,
//                 address: data.address,
//                 city: data.city ?? null,
//                 state: data.state ?? null,
//                 country: data.country ?? null,
//                 zipCode: data.zipCode ?? null,
//             },
//         });
//     } catch (error) {
//         if (error.code === "P2002") {
//             throw new Error("LOCATION_ALREADY_EXISTS");
//         }
//         throw error;
//     }
// };



import prisma from "../../lib/prisma.js";
import { parseCoordinates, haversineKm, boundingBox } from "../../utils/geo.utils.js";

const DEFAULT_RADIUS_KM = 10;
const MAX_RADIUS_KM = 100;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const createLocation = async ({
    name,
    address,
    city,
    state,
    country,
    zipCode,
    latitude,
    longitude,
    placeId,
}) => {
    if (!name || !address) {
        throw new Error("LOCATION_NAME_AND_ADDRESS_REQUIRED");
    }

    // Required on create. Throws INVALID_COORDINATES when missing or out of range.
    const coordinates = parseCoordinates(latitude, longitude);

    try {
        return await prisma.location.create({
            data: {
                name,
                address,
                city: city ?? null,
                state: state ?? null,
                country: country ?? "India",
                zipCode: zipCode ?? null,
                placeId: placeId ?? null,
                ...coordinates,
            },
        });
    } catch (error) {
        // Unique constraint (name + address)
        if (error.code === "P2002") {
            throw new Error("LOCATION_ALREADY_EXISTS");
        }
        throw error;
    }
};

export const listLocations = async () => {
    return prisma.location.findMany({
        orderBy: { createdAt: "desc" },
    });
};

export const getLocationById = async (id) => {
    const location = await prisma.location.findUnique({
        where: { id },
    });

    if (!location) {
        throw new Error("LOCATION_NOT_FOUND");
    }

    return location;
};

// Partial update: only fields present in the body change (omitted fields are kept).
// Send an explicit null to clear an optional field.
export const updateLocation = async (id, data) => {
    const update = {};
    for (const key of ["name", "address", "city", "state", "country", "zipCode", "placeId"]) {
        if (data[key] !== undefined) update[key] = data[key];
    }

    if (("name" in update && !update.name) || ("address" in update && !update.address)) {
        throw new Error("LOCATION_NAME_AND_ADDRESS_REQUIRED");
    }

    // Latitude and longitude must be updated together
    if (data.latitude !== undefined || data.longitude !== undefined) {
        Object.assign(update, parseCoordinates(data.latitude, data.longitude));
    }

    try {
        return await prisma.location.update({
            where: { id },
            data: update,
        });
    } catch (error) {
        if (error.code === "P2002") {
            throw new Error("LOCATION_ALREADY_EXISTS");
        }
        if (error.code === "P2025") {
            throw new Error("LOCATION_NOT_FOUND");
        }
        throw error;
    }
};

// Locations within radiusKm of a point, nearest first, each with distanceKm
export const findNearbyLocations = async ({ latitude, longitude, radiusKm, limit }) => {
    const { latitude: lat, longitude: lng } = parseCoordinates(latitude, longitude);

    const radius = radiusKm === undefined ? DEFAULT_RADIUS_KM : Number(radiusKm);
    if (!Number.isFinite(radius) || radius <= 0 || radius > MAX_RADIUS_KM) {
        throw new Error("INVALID_RADIUS");
    }

    const max = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const box = boundingBox(lat, lng, radius);

    // Rows with null coordinates never match the range filters
    const candidates = await prisma.location.findMany({
        where: {
            latitude: { gte: box.minLat, lte: box.maxLat },
            longitude: { gte: box.minLng, lte: box.maxLng },
        },
    });

    return candidates
        .map((loc) => ({
            ...loc,
            distanceKm: haversineKm(lat, lng, loc.latitude, loc.longitude),
        }))
        .filter((loc) => loc.distanceKm <= radius)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, max)
        .map((loc) => ({ ...loc, distanceKm: Math.round(loc.distanceKm * 10) / 10 }));
};