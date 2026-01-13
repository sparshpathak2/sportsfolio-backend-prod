export class ScoringEngine {
    applyEvent(_) {
        throw new Error("applyEvent() must be implemented by subclass");
    }

    async persist(_, __) {
        throw new Error("persist() must be implemented by subclass");
    }
}
