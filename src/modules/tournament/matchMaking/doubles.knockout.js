import { normalizeDoublesTeams } from "./helpers/teams.js";
import { nextPowerOfTwo } from "./helpers/bracket.js";
import { shuffle } from "./helpers/shuffle.js";

export const runDoublesKnockout = async (tournament) => {
    const teams = await normalizeDoublesTeams(tournament);

    if (teams.length < 2) throw new Error("NOT_ENOUGH_TEAMS");

    const max = tournament.rules.maxParticipants;
    const selected = shuffle(teams).slice(0, max);

    const bracketSize = nextPowerOfTwo(selected.length);
    const byes = bracketSize - selected.length;

    const matchTeams = selected.slice(byes);

    for (let i = 0; i < matchTeams.length; i += 2) {
        await createDoublesMatch(
            tournament,
            matchTeams[i],
            matchTeams[i + 1]
        );
    }

    await prisma.tournament.update({
        where: { id: tournament.id },
        data: { status: "ONGOING", matchMakingAt: new Date() },
    });
};
