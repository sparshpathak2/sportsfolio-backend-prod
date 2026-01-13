import prisma from "../../../lib/prisma.js";
import { shuffle } from "../matchMaking/helpers/shuffle.js";
import { createBracketMatch } from "../../match/match.service.js";

// export const generateKnockoutNextRound = async (tournamentId) => {
//     const tournament = await prisma.tournament.findUnique({
//         where: { id: tournamentId },
//         include: {
//             matches: {
//                 include: {
//                     winnerParticipant: true,
//                 },
//             },
//             rules: true,
//         },
//     });

//     if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");
//     if (tournament.status !== "ONGOING") {
//         throw new Error("TOURNAMENT_NOT_ONGOING");
//     }

//     if (tournament.matches.length === 0) {
//         throw new Error("NO_MATCHES_FOUND");
//     }

//     // 1️⃣ Find last round
//     const lastRound = Math.max(
//         ...tournament.matches.map(m => m.round ?? 1)
//     );

//     console.log("lastRound in generateKnockoutNextRound:", lastRound)

//     const lastRoundMatches = tournament.matches.filter(
//         m => m.round === lastRound
//     );

//     console.log("lastRoundMatches in generateKnockoutNextRound:", lastRoundMatches)

//     // 2️⃣ Ensure all matches are completed
//     const incomplete = lastRoundMatches.find(
//         m => m.status !== "COMPLETED"
//     );

//     if (incomplete) {
//         throw new Error("ROUND_NOT_COMPLETED");
//     }

//     // 3️⃣ Collect winners
//     const winners = lastRoundMatches
//         .map(m => m.winnerParticipant?.userId)
//         .filter(Boolean);

//     console.log("winners at generateKnockoutNextRound:", winners)

//     if (winners.length === 0) {
//         throw new Error("NO_WINNERS_FOUND");
//     }

//     // 4️⃣ Tournament completed
//     if (winners.length === 1) {
//         await prisma.tournament.update({
//             where: { id: tournamentId },
//             data: {
//                 status: "COMPLETED",
//             },
//         });

//         return {
//             completed: true,
//             championUserId: winners[0],
//         };
//     }

//     // 5️⃣ Shuffle winners for fairness
//     const shuffled = shuffle([...winners]);

//     // 6️⃣ Handle bye
//     let byePlayer = null;
//     if (shuffled.length % 2 !== 0) {
//         byePlayer = shuffled.shift();
//     }

//     const nextRound = lastRound + 1;

//     // 7️⃣ Create next round matches
//     await prisma.$transaction(async (tx) => {
//         for (let i = 0; i < shuffled.length; i += 2) {
//             await createBracketMatch(tx, {
//                 tournament,
//                 playerAId: shuffled[i],
//                 playerBId: shuffled[i + 1],
//                 round: nextRound,
//             });
//         }
//     });

//     return {
//         round: nextRound,
//         matchesCreated: Math.floor(shuffled.length / 2),
//         byePlayer,
//     };
// };


export const generateKnockoutNextRound = async (tournamentId) => {
    // 1️⃣ Fetch tournament + last round matches
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
            matches: {
                where: {
                    status: "COMPLETED",
                },
                include: {
                    winnerParticipant: true,
                },
                orderBy: {
                    matchNumber: "asc",
                },
            },
        },
    });

    if (!tournament) throw new Error("TOURNAMENT_NOT_FOUND");

    // 2️⃣ Identify last round number
    const lastRound = Math.max(...tournament.matches.map(m => m.round));

    const lastRoundMatches = tournament.matches.filter(
        m => m.round === lastRound
    );

    if (lastRoundMatches.length === 0) {
        throw new Error("NO_MATCHES_FOUND");
    }

    // 3️⃣ Ensure all matches of the round are completed
    const incomplete = lastRoundMatches.some(
        m => !m.winnerParticipantId
    );

    if (incomplete) {
        throw new Error("ROUND_NOT_COMPLETED");
    }

    // 4️⃣ If this was the final round → tournament complete
    if (lastRoundMatches.length === 1) {
        const finalMatch = lastRoundMatches[0];

        await prisma.tournament.update({
            where: { id: tournamentId },
            data: { status: "COMPLETED" },
        });

        return {
            completed: true,
            championUserId: finalMatch.winnerParticipant.userId,
        };
    }

    // 5️⃣ Group winners by next matchNumber
    const nextRoundMap = new Map();

    for (const match of lastRoundMatches) {
        const nextMatchNumber = Math.ceil(match.matchNumber / 2);

        if (!nextRoundMap.has(nextMatchNumber)) {
            nextRoundMap.set(nextMatchNumber, []);
        }

        nextRoundMap
            .get(nextMatchNumber)
            .push(match.winnerParticipant.userId);
    }

    const nextRound = lastRound + 1;

    // 6️⃣ Create next round matches
    await prisma.$transaction(async (tx) => {
        for (const [matchNumber, players] of nextRoundMap.entries()) {
            if (players.length === 2) {
                await createBracketMatch(tx, {
                    tournament,
                    round: nextRound,
                    matchNumber,
                    playerAId: players[0],
                    playerBId: players[1],
                });
            }

            // Bye → auto-advance (single player)
            if (players.length === 1) {
                await createBracketMatch(tx, {
                    tournament,
                    round: nextRound,
                    matchNumber,
                    playerAId: players[0],
                    playerBId: null,
                });
            }
        }
    });

    return {
        completed: false,
        round: nextRound,
        matchesCreated: nextRoundMap.size,
    };
};
