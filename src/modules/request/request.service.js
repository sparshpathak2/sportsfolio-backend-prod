import prisma from "../../lib/prisma.js";

/**
 * Create a new join request for a tournament
 */
export const createRequest = async ({ tournamentId, userId, teamId, message }) => {
    // 1. Validate tournament
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { rules: true }
    });

    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
    if (tournament.status !== "PUBLISHED") throw new Error("TOURNAMENT_NOT_OPEN");

    // 2. Validate requester context
    if (!userId && !teamId) throw new Error("USER_OR_TEAM_ID_REQUIRED");

    // 3. Check if already a participant
    const participationCheckConditions = [];
    if (userId) participationCheckConditions.push({ playerId: userId });
    if (teamId) participationCheckConditions.push({ teamId: teamId });

    if (participationCheckConditions.length > 0) {
        const existingParticipation = await prisma.tournamentParticipant.findFirst({
            where: {
                tournamentId,
                OR: participationCheckConditions
            }
        });
        if (existingParticipation) throw new Error("ALREADY_PARTICIPATING");
    }

    // 4. Check for existing pending request
    const existingRequest = await prisma.tournamentRequest.findFirst({
        where: {
            tournamentId,
            userId: userId || null,
            teamId: teamId || null,
            status: "PENDING"
        }
    });
    if (existingRequest) throw new Error("REQUEST_ALREADY_PENDING");

    // 5. Create the request
    return prisma.tournamentRequest.create({
        data: {
            tournamentId,
            userId: userId || null,
            teamId: teamId || null,
            message,
            status: "PENDING"
        }
    });
};

/**
 * List all requests for a specific tournament (for Organizers)
 */
export const listTournamentRequests = async (tournamentId, organizerId) => {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId }
    });

    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
    if (tournament.organizerId !== organizerId) throw new Error("NOT_AUTHORIZED_TO_VIEW_REQUESTS");

    return prisma.tournamentRequest.findMany({
        where: { tournamentId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    profileImage: true,
                    phone: true
                }
            },
            team: {
                select: {
                    id: true,
                    name: true,
                    logo: true
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });
};

/**
 * Update request status (Accept/Reject) - Only for Organizers
 */
export const updateRequestStatus = async (requestId, status, organizerId) => {
    if (!["ACCEPTED", "REJECTED"].includes(status)) {
        throw new Error("INVALID_STATUS");
    }

    return prisma.$transaction(async (tx) => {
        const request = await tx.tournamentRequest.findUnique({
            where: { id: requestId },
            include: { tournament: true }
        });

        if (!request) throw new Error("REQUEST_NOT_FOUND");
        if (request.status !== "PENDING") throw new Error("REQUEST_ALREADY_PROCESSED");

        // Verify organizer
        if (request.tournament.organizerId !== organizerId) {
            throw new Error("NOT_AUTHORIZED_TO_UPDATE_REQUEST");
        }

        if (status === "ACCEPTED") {
            // Check if already a participant (safety check)
            const exists = await tx.tournamentParticipant.findFirst({
                where: {
                    tournamentId: request.tournamentId,
                    playerId: request.userId,
                    teamId: request.teamId
                }
            });

            if (!exists) {
                // Add to participants
                await tx.tournamentParticipant.create({
                    data: {
                        tournamentId: request.tournamentId,
                        playerId: request.userId,
                        teamId: request.teamId
                    }
                });
            }
        }

        // Update the request status
        return tx.tournamentRequest.update({
            where: { id: requestId },
            data: { status }
        });
    });
};

/**
 * List requests sent by the current user (either personal or via team)
 */
export const listMySentRequests = async (userId) => {
    return prisma.tournamentRequest.findMany({
        where: {
            OR: [
                { userId },
                { team: { members: { some: { userId } } } }
            ]
        },
        include: {
            tournament: {
                select: {
                    id: true,
                    name: true,
                    logo: true,
                    city: true,
                    startDate: true
                }
            },
            team: {
                select: {
                    id: true,
                    name: true,
                    logo: true
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });
};
