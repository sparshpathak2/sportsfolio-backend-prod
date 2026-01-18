import prisma from "../../lib/prisma.js";

export const getUserProfile = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            city: true,
            profileImage: true,

            favoriteTeams: {
                select: {
                    team: {
                        select: {
                            id: true,
                            name: true,
                            sportCode: true,
                        },
                    },
                },
            },

            favoriteUsers: {
                select: {
                    favoriteUser: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            city: true,
                        },
                    },
                },
            },
        },
    });

    if (!user) return null;

    return {
        user: {
            id: user.id,
            name: user.name,
            username: user.username,
            phone: user.phone,
            city: user.city,
            profileImage: user.profileImage,
        },
        favorites: {
            teams: user.favoriteTeams.map((fav) => fav.team),
            players: user.favoriteUsers.map((fav) => fav.favoriteUser),
        },
    };
};


export const updateUserProfile = async (userId, data) => {
    const { name, username, city, profileImage } = data;

    // Optional: prevent empty update
    if (!name && !username && !city && !profileImage) {
        throw new Error("NO_FIELDS_TO_UPDATE");
    }

    // Username uniqueness check (important)
    if (username) {
        const existingUser = await prisma.user.findFirst({
            where: {
                username,
                NOT: { id: userId },
            },
        });

        if (existingUser) {
            throw new Error("USERNAME_ALREADY_TAKEN");
        }
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            ...(name !== undefined && { name }),
            ...(username !== undefined && { username }),
            ...(city !== undefined && { city }),
            ...(profileImage !== undefined && { profileImage }),
        },
        select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            city: true,
            profileImage: true,
        },
    });

    return updatedUser;
};