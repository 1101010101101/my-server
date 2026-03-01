/**
 * app.config.ts
 *
 * Colyseus server configuration.
 * Registers the CubeRoom with message-based sync (no schema state).
 *
 * Start with:
 *   npx colyseus-tools start
 */

import config from "@colyseus/tools";
import { CubeRoom } from "./rooms/CubeRoom";

export default config({
    initializeGameServer: (gameServer) => {
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
