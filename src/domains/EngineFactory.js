import { BadmintonMatchProgression } from "./engines/badminton/BadmintonMatchProgression.js";
import { BadmintonScoringEngine } from "./engines/badminton/BadmintonScoringEngine.js";
// import { CricketScoringEngine } from "./cricket/CricketScoringEngine";
// import { FootballScoringEngine } from "./football/FootballScoringEngine";

export class EngineFactory {
    static getScoringEngine(sportCode) {
        switch (sportCode) {
            case "BADMINTON":
                return new BadmintonScoringEngine();
            // case "CRICKET":
            //     return new CricketScoringEngine();
            // case "FOOTBALL":
            //     return new FootballScoringEngine();
            default:
                throw new Error(`No scoring engine for sport: ${sportCode}`);
        }
    }
}


export class MatchProgressionFactory {
    static getEngine(sportCode) {
        switch (sportCode) {
            case "BADMINTON":
                return new BadmintonMatchProgression();
            default:
                throw new Error(`No match progression engine for ${sportCode}`);
        }
    }
}
