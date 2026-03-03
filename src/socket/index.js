import { recordEvent, getMatchState, undoLastScore } from "../modules/match/match.service.js";
import prisma from "../lib/prisma.js";

// Store active match rooms and their subscribers
const matchRooms = new Map();

export const initializeSocket = (io) => {
    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            console.log("========== SOCKET AUTH DEBUG ==========");

            // Method 1: Check for sessionId in cookie
            const cookieHeader = socket.handshake.headers.cookie;
            let sessionId = null;
            let userId = socket.handshake.auth.userId; // Keep existing method as fallback

            if (cookieHeader) {
                // Parse cookies properly
                const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split('=');
                    acc[key] = value;
                    return acc;
                }, {});

                sessionId = cookies['sessionId'];
                console.log("Parsed sessionId from cookie:", sessionId);
            }

            // Method 2: Check query params
            if (!sessionId && socket.handshake.query.sessionId) {
                sessionId = socket.handshake.query.sessionId;
                console.log("Got sessionId from query:", sessionId);
            }

            // Method 3: Check handshake auth
            if (!sessionId && socket.handshake.auth.sessionId) {
                sessionId = socket.handshake.auth.sessionId;
                console.log("Got sessionId from auth:", sessionId);
            }

            // If we have a sessionId, get the user from database
            if (sessionId) {
                const session = await prisma.session.findUnique({
                    where: { id: sessionId },
                    include: { user: true }
                });

                if (session && session.expiresAt > new Date()) {
                    userId = session.user.id;
                    socket.user = session.user;
                    console.log("✅ Authenticated via session, user:", userId);
                } else {
                    console.log("❌ Invalid or expired session");
                }
            }

            // Final check - we need a userId
            if (!userId) {
                console.log("❌ No userId found");
                return next(new Error("Authentication required"));
            }

            // Verify user exists
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!user) {
                console.log("❌ User not found:", userId);
                return next(new Error("User not found"));
            }

            // Set user data on socket
            socket.userId = userId;
            socket.user = user;

            // Store matchId from query params if present
            const matchId = socket.handshake.query.matchId;
            if (matchId) {
                socket.matchId = matchId;
                console.log(`📌 Match ID from query: ${matchId}`);
            }

            console.log("✅ Auth successful for user:", userId);
            next();

        } catch (error) {
            console.error("Auth middleware error:", error);
            next(new Error("Authentication failed"));
        }
    });

    // Connection handler
    io.on("connection", (socket) => {
        console.log(`🔌 Client connected: ${socket.id} (User: ${socket.userId})`);

        // ============================================
        // JOIN MATCH ROOM - ANY authenticated user can join (spectators)
        // ============================================
        socket.on("join-match", async (data) => {
            try {
                console.log("📥 Received join-match event (raw):", data);
                console.log("📥 Type of data:", typeof data);

                // Handle different possible data formats
                let matchId;

                if (typeof data === 'string') {
                    // If data is a string, try to parse it
                    try {
                        const parsed = JSON.parse(data);
                        matchId = parsed.matchId;
                    } catch (e) {
                        console.log("❌ Failed to parse string data:", e);
                    }
                } else if (typeof data === 'object' && data !== null) {
                    // If data is an object, extract matchId directly
                    matchId = data.matchId;
                } else if (Array.isArray(data) && data.length > 0) {
                    // If data is an array, take first element
                    const firstArg = data[0];
                    matchId = firstArg?.matchId;
                }

                console.log("📌 Extracted matchId:", matchId);

                if (!matchId) {
                    console.log("❌ No matchId found in data");
                    socket.emit("error", { message: "matchId is required" });
                    return;
                }

                // ✅ SPECTATOR ACCESS: Just verify match exists (don't check participation)
                const match = await prisma.match.findUnique({
                    where: { id: matchId },
                    select: {
                        id: true,
                        status: true,
                        sportCode: true,
                        gameType: true
                    }
                });

                if (!match) {
                    console.log(`❌ Match ${matchId} not found`);
                    socket.emit("error", { message: "Match not found" });
                    return;
                }

                // Check if user is a participant (for UI purposes, not for access)
                const participant = await prisma.matchParticipant.findFirst({
                    where: {
                        matchId: matchId,
                        userId: socket.userId
                    }
                });

                // Leave previous match room if any
                if (socket.matchId && socket.matchId !== matchId) {
                    console.log(`👋 Leaving previous match room: ${socket.matchId}`);
                    socket.leave(`match:${socket.matchId}`);

                    // Remove from tracking
                    const oldRoom = matchRooms.get(socket.matchId);
                    if (oldRoom) {
                        oldRoom.delete(socket.id);
                        if (oldRoom.size === 0) {
                            matchRooms.delete(socket.matchId);
                            console.log(`🧹 Room for match ${socket.matchId} deleted (empty)`);
                        }
                    }
                }

                // Join new match room
                socket.join(`match:${matchId}`);
                socket.matchId = matchId;
                socket.isParticipant = !!participant; // Store participant status

                // Track room subscribers
                if (!matchRooms.has(matchId)) {
                    matchRooms.set(matchId, new Set());
                }
                matchRooms.get(matchId).add(socket.id);

                // Send current match state
                console.log(`📊 Fetching match state for ${matchId}`);
                const matchState = await getMatchState(matchId);

                console.log(`📤 Sending match-state to client ${socket.id}`);
                socket.emit("match-state", {
                    ...matchState,
                    userRole: participant ? "participant" : "spectator"
                });

                // Notify others in room
                socket.to(`match:${matchId}`).emit("player-joined", {
                    userId: socket.userId,
                    socketId: socket.id,
                    userName: socket.user?.name || `User ${socket.userId}`,
                    role: participant ? "participant" : "spectator"
                });

                console.log(`👤 User ${socket.userId} (${participant ? 'participant' : 'spectator'}) joined match ${matchId} (Total in room: ${matchRooms.get(matchId).size})`);

            } catch (error) {
                console.error("❌ Error joining match:", error);
                socket.emit("error", { message: "Failed to join match: " + error.message });
            }
        });

        // ============================================
        // SCORE EVENT - ONLY participants can score
        // ============================================
        socket.on("score-event", async (data) => {
            try {
                console.log("📥 Received score-event:", JSON.stringify(data, null, 2));

                // Handle different data formats
                let matchId, type, payload;

                if (Array.isArray(data)) {
                    // If data is array of arguments
                    matchId = data[0]?.matchId;
                    type = data[1]?.type;
                    payload = data[2]?.payload;
                } else if (typeof data === 'object') {
                    // If data is a single object with all fields
                    matchId = data.matchId;
                    type = data.type;
                    payload = data.payload;
                }

                if (!socket.matchId || socket.matchId !== matchId) {
                    socket.emit("error", { message: "Not in this match room" });
                    return;
                }

                // ✅ RESTRICTED: Only participants can score
                const participant = await prisma.matchParticipant.findFirst({
                    where: {
                        matchId: matchId,
                        userId: socket.userId
                    }
                });

                if (!participant) {
                    console.log(`❌ Non-participant ${socket.userId} tried to score in match ${matchId}`);
                    socket.emit("error", { message: "Only match participants can record scores" });
                    return;
                }

                // 🔥 FIX: Don't modify the payload - let recordEvent handle both fields
                // Pass the payload exactly as received from the client
                console.log(`🎯 Processing score event for match ${matchId} by participant ${socket.userId}`);
                console.log("📦 Original payload:", payload);

                // Process the event using existing service - pass ORIGINAL payload
                const result = await recordEvent({
                    matchId,
                    type,
                    payload: payload  // ← Pass untouched! recordEvent handles both userId and scoringParticipantId
                });

                // Get updated match state
                const updatedMatch = await getMatchState(matchId);

                // Broadcast to all in the match room (spectators and participants)
                console.log(`📤 Broadcasting match-update to room match:${matchId}`);
                io.to(`match:${matchId}`).emit("match-update", {
                    type: "score",
                    event: {
                        type,
                        payload: payload,  // ← Send original payload
                        userId: socket.userId,
                        timestamp: new Date().toISOString()
                    },
                    match: updatedMatch,
                    scoringState: result.scoringState,
                    matchCompleted: result.matchCompleted
                });

                // If match completed, send completion event
                if (result.matchCompleted) {
                    io.to(`match:${matchId}`).emit("match-completed", {
                        winner: result.winnerInfo || updatedMatch.winnerParticipantId,
                        finalScore: updatedMatch.parts,
                        match: updatedMatch
                    });

                    console.log(`🏆 Match ${matchId} completed! Winner: ${result.winnerInfo?.name || result.winnerInfo}`);

                    // Clean up room after 5 minutes
                    setTimeout(() => {
                        const room = matchRooms.get(matchId);
                        if (room && room.size === 0) {
                            matchRooms.delete(matchId);
                            console.log(`🧹 Cleaned up room for match ${matchId}`);
                        }
                    }, 5 * 60 * 1000);
                }

                console.log(`✅ Score event processed for match ${matchId}`);

            } catch (error) {
                console.error("❌ Error processing score event:", error);
                socket.emit("error", { message: error.message });
            }
        });


        // ============================================
        // UNDO LAST SCORE - Only participants can undo
        // ============================================
        socket.on("undo-last", async () => {
            try {
                if (!socket.matchId) {
                    socket.emit("error", { message: "Not in any match room" });
                    return;
                }

                console.log(`↩️ Undo requested for match ${socket.matchId} by user ${socket.userId}`);

                // Check if user is a participant
                const participant = await prisma.matchParticipant.findFirst({
                    where: {
                        matchId: socket.matchId,
                        userId: socket.userId
                    }
                });

                if (!participant) {
                    socket.emit("error", { message: "Only match participants can undo scores" });
                    return;
                }

                // Call the undo service
                const result = await undoLastScore({
                    matchId: socket.matchId,
                    requestedByUserId: socket.userId
                });

                // Get updated match state
                const updatedMatch = await getMatchState(socket.matchId);

                // Broadcast to everyone
                io.to(`match:${socket.matchId}`).emit("match-update", {
                    type: "undo",
                    match: updatedMatch,
                    timestamp: new Date().toISOString()
                });

                // Confirm to requester
                socket.emit("undo-confirmed", {
                    success: true,
                    message: "Last score undone successfully"
                });

            } catch (error) {
                console.error("❌ Error undoing last score:", error);
                socket.emit("error", { message: error.message });
            }
        });

        // ============================================
        // GET MATCH STATE - Any authenticated user in room
        // ============================================
        socket.on("get-match-state", async () => {
            try {
                if (!socket.matchId) {
                    socket.emit("error", { message: "Not in any match room" });
                    return;
                }

                console.log(`📊 Fetching match state for ${socket.matchId} (requested by client)`);
                const match = await getMatchState(socket.matchId);

                // Include user role
                const participant = await prisma.matchParticipant.findFirst({
                    where: {
                        matchId: socket.matchId,
                        userId: socket.userId
                    }
                });

                socket.emit("match-state", {
                    ...match,
                    userRole: participant ? "participant" : "spectator"
                });

            } catch (error) {
                console.error("❌ Error getting match state:", error);
                socket.emit("error", { message: "Failed to get match state" });
            }
        });

        // ============================================
        // DISCONNECT HANDLER
        // ============================================
        socket.on("disconnect", () => {
            console.log(`🔌 Client disconnected: ${socket.id} (User: ${socket.userId})`);

            if (socket.matchId) {
                // Remove from tracking
                const room = matchRooms.get(socket.matchId);
                if (room) {
                    room.delete(socket.id);

                    // Notify others
                    socket.to(`match:${socket.matchId}`).emit("player-left", {
                        userId: socket.userId,
                        socketId: socket.id,
                        userName: socket.user?.name || `User ${socket.userId}`,
                        remainingPlayers: room.size
                    });

                    console.log(`👋 User ${socket.userId} left match ${socket.matchId} (${room.size} remaining)`);

                    // Clean up empty room
                    if (room.size === 0) {
                        matchRooms.delete(socket.matchId);
                        console.log(`🧹 Room for match ${socket.matchId} deleted (empty)`);
                    }
                }
            }
        });
    });
};