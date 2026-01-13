import { runSinglesKnockout } from "./singles.knockout.js";
import { runDoublesKnockout } from "./doubles.knockout.js";

export const knockoutMatchmaking = async (tournament) => {
    if (!tournament.rules) throw new Error("RULES_MISSING");

    if (tournament.rules.gameType === "SINGLES") {
        return runSinglesKnockout(tournament);
    }

    if (tournament.rules.gameType === "DOUBLES") {
        return runDoublesKnockout(tournament);
    }
};
