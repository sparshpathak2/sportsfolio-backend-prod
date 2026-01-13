import prisma from "../../lib/prisma.js";

export const createLocation = async ({
    name,
    address,
    city,
    state,
    country,
    zipCode,
}) => {
    // ✅ Correct validation
    if (!name || !address) {
        throw new Error("LOCATION_NAME_AND_ADDRESS_REQUIRED");
    }

    try {
        return await prisma.location.create({
            data: {
                name,
                address,
                city: city ?? null,
                state: state ?? null,
                country: country ?? "India",
                zipCode: zipCode ?? null,
            },
        });
    } catch (error) {
        // ✅ Handle unique constraint
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

export const updateLocation = async (id, data) => {
    try {
        return await prisma.location.update({
            where: { id },
            data: {
                name: data.name,
                address: data.address,
                city: data.city ?? null,
                state: data.state ?? null,
                country: data.country ?? null,
                zipCode: data.zipCode ?? null,
            },
        });
    } catch (error) {
        if (error.code === "P2002") {
            throw new Error("LOCATION_ALREADY_EXISTS");
        }
        throw error;
    }
};
