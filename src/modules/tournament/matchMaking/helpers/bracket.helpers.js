export const nextPowerOfTwo = (n) =>
    Math.pow(2, Math.ceil(Math.log2(n)));


// Calculate the number of rounds needed for a given number of teams
export const calculateRounds = (teamCount) => {
    const bracketSize = nextPowerOfTwo(teamCount);
    return Math.ceil(Math.log2(bracketSize));
};

// Calculate the number of matches in each round
export const calculateMatchesPerRound = (teamCount) => {
    const bracketSize = nextPowerOfTwo(teamCount);
    const rounds = calculateRounds(teamCount);
    const matchesPerRound = [];

    let remainingTeams = bracketSize;
    for (let round = 1; round <= rounds; round++) {
        matchesPerRound.push(remainingTeams / 2);
        remainingTeams /= 2;
    }

    return matchesPerRound;
};

// Generate the complete bracket structure
export const generateBracketStructure = (teamCount) => {
    const bracketSize = nextPowerOfTwo(teamCount);
    const rounds = calculateRounds(teamCount);
    const structure = [];

    for (let round = 1; round <= rounds; round++) {
        const matchesInRound = bracketSize / Math.pow(2, round);
        const roundMatches = [];

        for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
            roundMatches.push({
                round,
                matchIndex,
                // First round has actual teams, later rounds have TBD
                hasActualTeams: round === 1,
                // Track which matches feed into this one (for later rounds)
                feedsFrom: round > 1 ? [
                    { round: round - 1, matchIndex: matchIndex * 2 },
                    { round: round - 1, matchIndex: matchIndex * 2 + 1 }
                ] : null
            });
        }

        structure.push(roundMatches);
    }

    return structure;
};

// Calculate bye positions
export const calculateByes = (teams, bracketSize) => {
    const byes = bracketSize - teams.length;
    // Higher seeded teams get byes
    return {
        byeTeams: teams.slice(0, byes),
        firstRoundTeams: teams.slice(byes)
    };
};