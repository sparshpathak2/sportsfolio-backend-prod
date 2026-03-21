import prisma from "../../lib/prisma.js";

// ==================== TEAM FAVORITES ==================== //

/**
 * Add a team to user's favorites
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID to favorite
 */
export const addFavoriteTeam = async (userId, teamId) => {
    // Check if team exists
    const team = await prisma.team.findUnique({
        where: { id: teamId }
    });
    if (!team) throw new Error("TEAM_NOT_FOUND");

    // Check if already favorited
    const existing = await prisma.favoriteTeam.findUnique({
        where: {
            userId_teamId: {
                userId,
                teamId
            }
        }
    });

    if (existing) {
        throw new Error("TEAM_ALREADY_FAVORITED");
    }

    return prisma.favoriteTeam.create({
        data: {
            userId,
            teamId
        },
        include: {
            team: {
                select: {
                    id: true,
                    name: true,
                    sportCode: true,
                    logo: true,
                    city: true
                }
            }
        }
    });
};

/**
 * Remove a team from user's favorites
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID to remove
 */
export const removeFavoriteTeam = async (userId, teamId) => {
    const existing = await prisma.favoriteTeam.findUnique({
        where: {
            userId_teamId: {
                userId,
                teamId
            }
        }
    });

    if (!existing) {
        throw new Error("TEAM_NOT_FAVORITED");
    }

    return prisma.favoriteTeam.delete({
        where: {
            userId_teamId: {
                userId,
                teamId
            }
        }
    });
};

/**
 * Get all favorite teams for a user
 * @param {string} userId - User ID
 */
export const getUserFavoriteTeams = async (userId) => {
    return prisma.favoriteTeam.findMany({
        where: { userId },
        include: {
            team: {
                select: {
                    id: true,
                    name: true,
                    sportCode: true,
                    logo: true,
                    city: true,
                    createdAt: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
};

// ==================== USER FAVORITES ==================== //

/**
 * Add a user to user's favorites
 * @param {string} userId - Current user ID
 * @param {string} favoriteUserId - User ID to favorite
 */
export const addFavoriteUser = async (userId, favoriteUserId) => {
    // Check if user exists
    const userToFavorite = await prisma.user.findUnique({
        where: { id: favoriteUserId }
    });
    if (!userToFavorite) throw new Error("USER_NOT_FOUND");

    // Can't favorite yourself
    if (userId === favoriteUserId) {
        throw new Error("CANNOT_FAVORITE_SELF");
    }

    // Check if already favorited
    const existing = await prisma.favoriteUser.findUnique({
        where: {
            userId_favoriteUserId: {
                userId,
                favoriteUserId
            }
        }
    });

    if (existing) {
        throw new Error("USER_ALREADY_FAVORITED");
    }

    return prisma.favoriteUser.create({
        data: {
            userId,
            favoriteUserId
        },
        include: {
            favoriteUser: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    city: true,
                    profileImage: true
                }
            }
        }
    });
};

/**
 * Remove a user from user's favorites
 * @param {string} userId - Current user ID
 * @param {string} favoriteUserId - User ID to remove
 */
export const removeFavoriteUser = async (userId, favoriteUserId) => {
    const existing = await prisma.favoriteUser.findUnique({
        where: {
            userId_favoriteUserId: {
                userId,
                favoriteUserId
            }
        }
    });

    if (!existing) {
        throw new Error("USER_NOT_FAVORITED");
    }

    return prisma.favoriteUser.delete({
        where: {
            userId_favoriteUserId: {
                userId,
                favoriteUserId
            }
        }
    });
};

/**
 * Get all favorite users for a user
 * @param {string} userId - User ID
 */
export const getUserFavoriteUsers = async (userId) => {
    return prisma.favoriteUser.findMany({
        where: { userId },
        include: {
            favoriteUser: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    phone: true,
                    city: true,
                    profileImage: true,
                    sportProfiles: {
                        select: {
                            sportCode: true
                        }
                    }
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
};

/**
 * Check if a user has favorited a team
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 */
export const isTeamFavorited = async (userId, teamId) => {
    const favorite = await prisma.favoriteTeam.findUnique({
        where: {
            userId_teamId: {
                userId,
                teamId
            }
        }
    });
    return !!favorite;
};

/**
 * Check if a user has favorited another user
 * @param {string} userId - User ID
 * @param {string} favoriteUserId - Favorite user ID
 */
export const isUserFavorited = async (userId, favoriteUserId) => {
    const favorite = await prisma.favoriteUser.findUnique({
        where: {
            userId_favoriteUserId: {
                userId,
                favoriteUserId
            }
        }
    });
    return !!favorite;
};