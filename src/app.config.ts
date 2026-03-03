/**
 * app.config.ts
 *
 * Colyseus server configuration.
 * Registers the CubeRoom with message-based sync (no schema state).
 * Registers the built-in LobbyRoom for real-time room listing.
 *
 * Start with:
 *   npx colyseus-tools start
 */

import config from "@colyseus/tools";
import { LobbyRoom } from "colyseus";
import { CubeRoom } from "./rooms/CubeRoom";

export default config({
    initializeGameServer: (gameServer) => {
        // Built-in lobby room — clients join this to get real-time room list
        gameServer.define("lobby", LobbyRoom);

        // Register "my_room" — must match the roomName on the Unity client
        gameServer.define("my_room", CubeRoom)
            .enableRealtimeListing();
    },

    initializeExpress: (app) => {
        app.get("/health", (req, res) => {
            res.json({ status: "ok" });
        });
    },
});
