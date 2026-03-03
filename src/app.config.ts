/**
 * app.config.ts
 *
 * Colyseus server configuration.
 * - Registers CubeRoom with real-time listing
 * - Registers built-in LobbyRoom for real-time room list events
 * - Adds custom GET /matchmake/:roomName endpoint for HTTP room listing
 *
 * Start with:
 *   npx colyseus-tools start
 */

import config from "@colyseus/tools";
import { matchMaker, LobbyRoom } from "colyseus";
import { CubeRoom } from "./rooms/CubeRoom";

export default config({
    initializeGameServer: (gameServer) => {
        // Built-in lobby room for real-time room list events ("+", "-", "rooms")
        gameServer.define("lobby", LobbyRoom);

        // Game room — must match roomName on the Unity client
        gameServer.define("my_room", CubeRoom)
            .enableRealtimeListing();
    },

    initializeExpress: (app) => {
        // Health check
        app.get("/health", (req, res) => {
            res.json({ status: "ok" });
        });

        // Room listing endpoint — returns JSON array of available rooms
        // Used by the Unity client for HTTP polling
        app.get("/matchmake/:roomName", async (req, res) => {
            try {
                const rooms = await matchMaker.query({ name: req.params.roomName });
                // Map to a clean format matching RoomListEntry on the client
                const result = rooms.map((room: any) => ({
                    roomId: room.roomId,
                    name: room.name,
                    clients: room.clients,
                    maxClients: room.maxClients,
                    processId: room.processId,
                }));
                res.json(result);
            } catch (e) {
                console.error("[app.config] Error querying rooms:", e);
                res.json([]);
            }
        });
    },
});
