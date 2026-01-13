import prisma from "../../../lib/prisma.js"
import { createBracketMatch } from "../../match/match.service.js";
import { nextPowerOfTwo } from "./helpers/bracket.js";
import { shuffle } from "./helpers/shuffle.js";

export const runSinglesKnockout = async (tournament) => {
    // console.log("tournament at runSinglesKnockout:", tournament)
    const players = tournament.participants
        .filter(p => p.playerId)
        .map(p => p.playerId);

    const min = tournament.rules.minParticipants ?? 2;

    if (players.length < min) {
        throw new Error("MIN_PARTICIPANTS_NOT_MET");
    }

    const max = tournament.rules.maxParticipants ?? players.length;
    const selected = shuffle(players).slice(0, max);

    console.log("selected at runSinglesKnockout:", selected)

    const bracketSize = nextPowerOfTwo(selected.length);
    console.log("bracketSize at runSinglesKnockout:", bracketSize)
    const byes = bracketSize - selected.length;

    // 👇 implicit bye players
    const byePlayers = selected.slice(0, byes);
    console.log("byePlayers at runSinglesKnockout:", byePlayers)
    const matchPlayers = selected.slice(byes);
    console.log("matchPlayers at runSinglesKnockout:", matchPlayers)


    const round = 1;

    await prisma.$transaction(async (tx) => {
        // create only real matches
        for (let i = 0; i < matchPlayers.length; i += 2) {
            await createBracketMatch(tx, {
                tournament,
                playerAId: matchPlayers[i],
                playerBId: matchPlayers[i + 1],
                round,
            });
        }

        await tx.tournament.update({
            where: { id: tournament.id },
            data: {
                status: "ONGOING",
                matchMakingAt: new Date(),
            },
        });
    });

    return {
        round,
        matchesCreated: matchPlayers.length / 2,
        byePlayers,
        nextRoundParticipants: [...byePlayers],
    };
};
