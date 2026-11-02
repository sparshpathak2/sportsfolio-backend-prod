// // src/utils/geoFilter.utils.js
// // Central "nearby" logic. Query params: latitude, longitude, radiusKm.

// const EARTH_RADIUS_KM = 6371;
// const KM_PER_DEGREE = 111.32;

// export const DEFAULT_RADIUS_KM = 10;
// export const MAX_RADIUS_KM = 100;

// const GEO_ERRORS = new Set([
//     "INVALID_COORDINATES",
//     "COORDINATES_INCOMPLETE",
//     "INVALID_RADIUS",
// ]);

// /** True when the error came from this file (client mistake -> send 400). */
// export const isGeoError = (error) => GEO_ERRORS.has(error?.message);

// const isBlank = (v) => v === undefined || v === null || v === "";

// const toNumber = (v) => {
//     if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
//     if (typeof v === "string" && v.trim() !== "") return Number(v);
//     return NaN;
// };

// const toRad = (deg) => (deg * Math.PI) / 180;

// export const distanceKm = (lat1, lon1, lat2, lon2) => {
//     const dLat = toRad(lat2 - lat1);
//     const dLon = toRad(lon2 - lon1);
//     const a =
//         Math.sin(dLat / 2) ** 2 +
//         Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
//     return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
// };

// /**
//  * Reads latitude / longitude / radiusKm from req.query.
//  * Returns null when no coordinates were sent (filter not requested).
//  * Throws COORDINATES_INCOMPLETE | INVALID_COORDINATES | INVALID_RADIUS.
//  */
// export const parseGeoFilter = (query = {}) => {
//     const { latitude, longitude, radiusKm } = query;
//     const noLat = isBlank(latitude);
//     const noLng = isBlank(longitude);

//     if (noLat && noLng) return null; // radiusKm alone is ignored
//     if (noLat || noLng) throw new Error("COORDINATES_INCOMPLETE");

//     const lat = toNumber(latitude);
//     const lng = toNumber(longitude);
//     if (
//         Number.isNaN(lat) || Number.isNaN(lng) ||
//         lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
//         (lat === 0 && lng === 0)
//     ) {
//         throw new Error("INVALID_COORDINATES");
//     }

//     let radius = DEFAULT_RADIUS_KM;
//     if (!isBlank(radiusKm)) {
//         radius = toNumber(radiusKm);
//         if (Number.isNaN(radius) || radius <= 0 || radius > MAX_RADIUS_KM) {
//             throw new Error("INVALID_RADIUS");
//         }
//     }
//     return { latitude: lat, longitude: lng, radiusKm: radius };
// };

// // Square around the point: cheap DB prefilter before the exact distance check.
// const boundingBox = ({ latitude, longitude, radiusKm }) => {
//     const latDelta = radiusKm / KM_PER_DEGREE;
//     const cos = Math.cos(toRad(latitude));
//     const lngDelta = cos < 0.01 ? 180 : radiusKm / (KM_PER_DEGREE * cos);
//     const minLng = longitude - lngDelta;
//     const maxLng = longitude + lngDelta;

//     return {
//         latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
//         longitude:
//             minLng >= -180 && maxLng <= 180
//                 ? { gte: minLng, lte: maxLng }
//                 : { not: null },
//     };
// };

// /** Venues inside the radius, nearest first: [{ id, city, distanceKm }]. */
// export const findLocationsWithinRadius = async (db, geo) => {
//     const rows = await db.location.findMany({
//         where: boundingBox(geo),
//         select: { id: true, city: true, latitude: true, longitude: true },
//     });

//     return rows
//         .map((r) => ({
//             id: r.id,
//             city: r.city,
//             distanceKm: distanceKm(geo.latitude, geo.longitude, r.latitude, r.longitude),
//         }))
//         .filter((r) => r.distanceKm <= geo.radiusKm)
//         .sort((a, b) => a.distanceKm - b.distanceKm);
// };

// /** Just the venue ids. This is what tournaments and matches use. */
// export const findLocationIdsWithinRadius = async (db, geo) =>
//     (await findLocationsWithinRadius(db, geo)).map((l) => l.id);


// src/utils/geoFilter.utils.js
// Central "nearby" logic. Query params: latitude, longitude, radiusKm.

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE = 111.32;

export const DEFAULT_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 100;

const GEO_ERRORS = new Set([
    "INVALID_COORDINATES",
    "COORDINATES_INCOMPLETE",
    "INVALID_RADIUS",
    "INVALID_LOCATION_BY",
]);

/** True when the error came from this file (client mistake -> send 400). */
export const isGeoError = (error) => GEO_ERRORS.has(error?.message);

const isBlank = (v) => v === undefined || v === null || v === "";

const toNumber = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    if (typeof v === "string" && v.trim() !== "") return Number(v);
    return NaN;
};

const toRad = (deg) => (deg * Math.PI) / 180;

export const distanceKm = (lat1, lon1, lat2, lon2) => {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
};

/**
 * Reads latitude / longitude / radiusKm from req.query.
 * Returns null when no coordinates were sent (filter not requested).
 * Throws COORDINATES_INCOMPLETE | INVALID_COORDINATES | INVALID_RADIUS.
 */
export const parseGeoFilter = (query = {}) => {
    const { latitude, longitude, radiusKm } = query;
    const noLat = isBlank(latitude);
    const noLng = isBlank(longitude);

    if (noLat && noLng) return null; // radiusKm alone is ignored
    if (noLat || noLng) throw new Error("COORDINATES_INCOMPLETE");

    const lat = toNumber(latitude);
    const lng = toNumber(longitude);
    if (
        Number.isNaN(lat) || Number.isNaN(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
        (lat === 0 && lng === 0)
    ) {
        throw new Error("INVALID_COORDINATES");
    }

    let radius = DEFAULT_RADIUS_KM;
    if (!isBlank(radiusKm)) {
        radius = toNumber(radiusKm);
        if (Number.isNaN(radius) || radius <= 0 || radius > MAX_RADIUS_KM) {
            throw new Error("INVALID_RADIUS");
        }
    }
    return { latitude: lat, longitude: lng, radiusKm: radius };
};

// Square around the point: cheap DB prefilter before the exact distance check.
const boundingBox = ({ latitude, longitude, radiusKm }) => {
    const latDelta = radiusKm / KM_PER_DEGREE;
    const cos = Math.cos(toRad(latitude));
    const lngDelta = cos < 0.01 ? 180 : radiusKm / (KM_PER_DEGREE * cos);
    const minLng = longitude - lngDelta;
    const maxLng = longitude + lngDelta;

    return {
        latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
        longitude:
            minLng >= -180 && maxLng <= 180
                ? { gte: minLng, lte: maxLng }
                : { not: null },
    };
};

/** Venues inside the radius, nearest first: [{ id, city, distanceKm }]. */
export const findLocationsWithinRadius = async (db, geo) => {
    const rows = await db.location.findMany({
        where: boundingBox(geo),
        select: { id: true, city: true, latitude: true, longitude: true },
    });

    return rows
        .map((r) => ({
            id: r.id,
            city: r.city,
            distanceKm: distanceKm(geo.latitude, geo.longitude, r.latitude, r.longitude),
        }))
        .filter((r) => r.distanceKm <= geo.radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
};

/** Just the venue ids. This is what tournaments and matches use. */
export const findLocationIdsWithinRadius = async (db, geo) =>
    (await findLocationsWithinRadius(db, geo)).map((l) => l.id);

/* =====================================================================
   USERS ONLY
   ===================================================================== */

export const LOCATION_BY_MODES = ["home", "venues", "city"];

// Privacy: a very small radius lets someone narrow down where a user lives.
// "home" matching never uses a radius smaller than this.
export const MIN_HOME_RADIUS_KM = 2;

/**
 * ?locationBy=home,venues,city (comma separated, any combination).
 * Default: home + venues. Throws INVALID_LOCATION_BY on unknown values.
 */
export const parseLocationBy = (value) => {
    if (isBlank(value)) return ["home", "venues"];
    if (typeof value !== "string") throw new Error("INVALID_LOCATION_BY");

    const modes = [...new Set(value.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean))];
    if (!modes.length || modes.some((m) => !LOCATION_BY_MODES.includes(m))) {
        throw new Error("INVALID_LOCATION_BY");
    }
    return modes;
};

/** Users whose own saved coordinates are inside the radius. */
export const findUserIdsWithinRadius = async (db, geo, { includeArchived = false } = {}) => {
    const rows = await db.user.findMany({
        where: {
            ...boundingBox(geo),
            ...(includeArchived ? {} : { isArchived: false }),
        },
        select: { id: true, latitude: true, longitude: true },
    });

    return rows
        .filter((r) => distanceKm(geo.latitude, geo.longitude, r.latitude, r.longitude) <= geo.radiusKm)
        .map((r) => r.id);
};


/** Teams whose own saved base location is inside the radius. */
export const findTeamIdsWithinRadius = async (db, geo) => {
    const rows = await db.team.findMany({
        where: boundingBox(geo),
        select: { id: true, latitude: true, longitude: true },
    });

    return rows
        .filter((r) => distanceKm(geo.latitude, geo.longitude, r.latitude, r.longitude) <= geo.radiusKm)
        .map((r) => r.id);
};