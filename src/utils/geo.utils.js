const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;

const toNumber = (value) => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") return Number(value);
    return NaN; // null, undefined, "", booleans, objects
};

// Validates and normalizes a latitude/longitude pair (accepts numbers or numeric strings)
export const parseCoordinates = (latitude, longitude) => {
    const lat = toNumber(latitude);
    const lng = toNumber(longitude);

    const inRange =
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180;

    // (0, 0) is the classic "client sent nothing" value, so reject it
    if (!inRange || (lat === 0 && lng === 0)) {
        throw new Error("INVALID_COORDINATES");
    }

    return { latitude: lat, longitude: lng };
};

// For inline venue creation (tournaments/matches): optional, but validated if sent
export const parseOptionalCoordinates = (latitude, longitude) =>
    latitude == null && longitude == null ? {} : parseCoordinates(latitude, longitude);

// Great-circle distance in km
export const haversineKm = (lat1, lng1, lat2, lng2) => {
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
};

// Cheap rectangle used to prefilter rows in SQL before the exact distance check
export const boundingBox = (lat, lng, radiusKm) => {
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.max(Math.cos(toRad(lat)), 0.01));
    return {
        minLat: lat - latDelta,
        maxLat: lat + latDelta,
        minLng: lng - lngDelta,
        maxLng: lng + lngDelta,
    };
};