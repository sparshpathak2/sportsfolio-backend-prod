import { SportCode } from "@prisma/client";

/**
 * Normalize doubles teams for matchmaking:
 * - Keep full 2-member teams
 * - Merge single-member teams
 * - Eliminate leftover single-member teams
 */
export const normalizeDoublesTeams = async (tournament) => {
    // 1️⃣ Fetch all tournament participants with teams
    const participants = await prisma.tournamentParticipant.findMany({
        where: {
            tournamentId: tournament.id,
            teamId: { not: null },
        },
        include: {
            team: {
                include: {
                    members: true,
                },
            },
        },
    });

    const validTeams = [];
    const singleMemberTeams = [];

    for (const p of participants) {
        if (!p.team) continue;

        if (p.team.members.length === 2) {
            validTeams.push(p.team);
        } else if (p.team.members.length === 1) {
            singleMemberTeams.push(p.team);
        }
    }

    // ✅ Ensure sport code is valid
    if (!Object.values(SportCode).includes(tournament.sportCode)) {
        throw new Error("INVALID_SPORT_CODE");
    }

    // 2️⃣ Merge single-member teams in pairs
    shuffle(singleMemberTeams);

    while (singleMemberTeams.length >= 2) {
        const t1 = singleMemberTeams.pop();
        const t2 = singleMemberTeams.pop();

        const mergedTeam = await prisma.team.create({
            data: {
                name: "Auto Team",
                sportCode: tournament.sportCode,
                isTemporary: true,
                members: {
                    create: [
                        { userId: t1.members[0].userId },
                        { userId: t2.members[0].userId },
                    ],
                },
            },
            include: {
                members: true,
            },
        });

        validTeams.push(mergedTeam);
    }

    // 3️⃣ Handle leftover single-member team → eliminated
    if (singleMemberTeams.length === 1) {
        const loneTeam = singleMemberTeams[0];

        await prisma.tournamentParticipant.updateMany({
            where: {
                tournamentId: tournament.id,
                teamId: loneTeam.id,
            },
            data: { eliminated: true },
        });
    }

    return validTeams;
};

