export const REDIS_STREAMS = {
    ENGINE_INPUT: "engine:input",    // Price updates + trade instructions → Engine
    ENGINE_OUTPUT: "engine:output"   // Engine responses → HTTP Server
} as const