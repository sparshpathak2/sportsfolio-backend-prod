import { generateKnockoutNextRound } from "./knockout.round.js";

export const generateNextRound = async (tournamentId) => {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
            rules: true,
        },
    });

    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");

    if (tournament.tournamentType === "KNOCKOUT") {
        return generateKnockoutNextRound(tournamentId);
    }

    throw new Error("UNSUPPORTED_TOURNAMENT_TYPE");
};
