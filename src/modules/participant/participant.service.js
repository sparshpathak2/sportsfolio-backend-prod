import prisma from "../../lib/prisma.js";

/**
 * Add a participant to tournament
 * Supports PLAYER or TEAM
 */
export const addParticipant = async ({
    tournamentId,
    participantType, // "PLAYER" | "TEAM"
    playerId,
    teamId,
    seed,
}) => {
    // 1️⃣ Tournament must exist
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
    });

    if (!tournament) {
        throw new Error("Tournament not found");
    }

    // 2️⃣ Validate participant type
    if (participantType === "PLAYER" && !playerId) {
        throw new Error("playerId is required for PLAYER participation");
    }

    if (participantType === "TEAM" && !teamId) {
        throw new Error("teamId is required for TEAM participation");
    }

    // 3️⃣ Prevent duplicates
    const existing = await prisma.tournamentParticipant.findFirst({
        where: {
            tournamentId,
            playerId: participantType === "PLAYER" ? playerId : undefined,
            teamId: participantType === "TEAM" ? teamId : undefined,
        },
    });

    if (existing) {
        throw new Error("Participant already registered in tournament");
    }

    // 4️⃣ Create participant
    return prisma.tournamentParticipant.create({
        data: {
            tournamentId,
            playerId: participantType === "PLAYER" ? playerId : null,
            teamId: participantType === "TEAM" ? teamId : null,
            seed,
        },
    });
};

/**
 * List participants of a tournament
 */
export const listParticipants = async (tournamentId) => {
    return prisma.tournamentParticipant.findMany({
        where: { tournamentId },
        orderBy: {
            seed: "asc",
        },
    });
};

/**
 * Remove participant from tournament
 */
export const removeParticipant = async (participantId) => {
    const exists = await prisma.tournamentParticipant.findUnique({
        where: { id: participantId },
    });

    if (!exists) {
        throw new Error("Participant not found");
    }

    await prisma.tournamentParticipant.delete({
        where: { id: participantId },
    });
};


export const joinTournamentByCode = async ({
    joinCode,
    playerId,
    teamId,
}) => {
    return prisma.$transaction(async (tx) => {
        // 1️⃣ Find tournament
        const tournament = await tx.tournament.findUnique({
            where: { publicJoinCode: joinCode },
            include: { rules: true },
        });

        if (!tournament || !tournament.isPublic) {
            throw new Error("INVALID_OR_PRIVATE_TOURNAMENT");
        }

        if (tournament.startDate <= new Date()) {
            throw new Error("TOURNAMENT_ALREADY_STARTED");
        }

        // 2️⃣ Prevent duplicate participation
        const existing = await tx.tournamentParticipant.findFirst({
            where: {
                tournamentId: tournament.id,
                OR: [
                    playerId ? { playerId } : undefined,
                    teamId ? { teamId } : undefined,
                ].filter(Boolean),
            },
        });

        if (existing) {
            throw new Error("ALREADY_JOINED");
        }

        // 3️⃣ Validate participant type vs rules (Badminton-aware)
        if (tournament.rules) {
            if (
                tournament.rules.gameType === "SINGLES" &&
                !playerId
            ) {
                throw new Error("SINGLES_REQUIRES_PLAYER");
            }

            if (
                tournament.rules.gameType === "DOUBLES" &&
                !teamId
            ) {
                throw new Error("DOUBLES_REQUIRES_TEAM");
            }
        }

        // 4️⃣ Create participant
        return tx.tournamentParticipant.create({
            data: {
                tournamentId: tournament.id,
                playerId: playerId ?? null,
                teamId: teamId ?? null,
            },
        });
    });
};

export const joinTournament = async ({ tournamentId, playerId }) => {
    if (!tournamentId) {
        throw new Error("TOURNAMENT_ID_REQUIRED");
    }

    if (!playerId) {
        throw new Error("PLAYER_ID_REQUIRED");
    }

    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { participants: true },
    });

    if (!tournament) {
        throw new Error("TOURNAMENT_NOT_FOUND");
    }

    if (tournament.status !== "PUBLISHED") {
        throw new Error("TOURNAMENT_NOT_OPEN");
    }

    const alreadyJoined = await prisma.tournamentParticipant.findFirst({
        where: {
            tournamentId,
            playerId,
        },
    });

    if (alreadyJoined) {
        throw new Error("ALREADY_JOINED");
    }

    // Create the participant
    const participant = await prisma.tournamentParticipant.create({
        data: {
            tournamentId,
            playerId,
        },
        include: {
            player: {
                include: {
                    sportProfiles: true, // optional: include sportProfiles
                },
            },
            tournament: true, // optional: include tournament details
            team: true, // optional if team join
        },
    });

    return participant;
};
