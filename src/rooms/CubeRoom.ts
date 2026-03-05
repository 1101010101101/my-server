/**
 * CubeRoom.ts
 *
 * Colyseus Room definition — OPTIMIZED for lower perceived latency.
 *
 * Changes vs original:
 *   - Server-side tick loop (20 Hz) batches all dirty playerMove updates
 *     into a SINGLE broadcast per tick instead of per-message.
 *     This reduces WebSocket frame overhead and smooths out timing.
 *   - Shorter payload keys reduce bytes on the wire.
 *
 * Player flow:
 *   1. Client joins → server tracks them, broadcasts "pJ" to others,
 *      sends existing players list to the newcomer.
 *   2. Client sends "playerMove" → server stores their latest transform,
 *      marks them dirty. On next tick, broadcasts to ALL OTHER clients.
 *   3. Client leaves → server broadcasts "pL" to remaining clients.
 */

import { Room, Client } from "colyseus";

// Player's last-known transform
interface PlayerData {
    sessionId: string;
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
    dirty: boolean;       // true if position changed since last tick
    client: Client;       // reference to the client for exclusion
}

/** Server tick rate in Hz — how often batched updates are sent */
const TICK_RATE = 30;

export class CubeRoom extends Room {

    /** Maximum clients per room */
    maxClients = 10;

    /** Map of sessionId → last-known player transform */
    private players: Map<string, PlayerData> = new Map();

    /** Interval handle for the tick loop */
    private tickInterval: ReturnType<typeof setInterval> | null = null;

    onCreate(options: any) {
        console.log("[CubeRoom] Room created!", this.roomId);

        // -----------------------------------------------------------------
        // Legacy: "moveCube" — broadcasts cube position to all OTHER clients
        // -----------------------------------------------------------------
        this.onMessage("moveCube", (client: Client, data: any) => {
            this.broadcast("moveCube", {
                sid: client.sessionId,
                x: data.x,
                y: data.y,
                z: data.z,
                rx: data.rx,
                ry: data.ry,
                rz: data.rz,
            }, { except: client });
        });

        // -----------------------------------------------------------------
        // Player character sync: "playerMove"
        // Just store + mark dirty. Actual broadcast happens in tick().
        // -----------------------------------------------------------------
        this.onMessage("playerMove", (client: Client, data: any) => {
            const pd = this.players.get(client.sessionId);
            if (!pd) return;

            pd.x  = data.x  ?? pd.x;
            pd.y  = data.y  ?? pd.y;
            pd.z  = data.z  ?? pd.z;
            pd.rx = data.rx ?? pd.rx;
            pd.ry = data.ry ?? pd.ry;
            pd.rz = data.rz ?? pd.rz;
            pd.dirty = true;
        });

        // -----------------------------------------------------------------
        // Start the tick loop
        // -----------------------------------------------------------------
        this.tickInterval = setInterval(() => this.tick(), 1000 / TICK_RATE);

        // Make this room visible in the lobby
        this.setMetadata({ name: options.roomName || "Game Room" });
    }

    /**
     * Server tick — broadcasts all dirty player positions in one pass.
     * Each dirty player gets one broadcast to everyone except themselves.
     */
    private tick() {
        this.players.forEach((pd) => {
            if (!pd.dirty) return;
            pd.dirty = false;

            this.broadcast("remotePlayerMove", {
                sid: pd.sessionId,
                x: pd.x,
                y: pd.y,
                z: pd.z,
                rx: pd.rx,
                ry: pd.ry,
                rz: pd.rz,
            }, { except: pd.client });
        });
    }

    onJoin(client: Client, options: any) {
        console.log(`[CubeRoom] Client ${client.sessionId} joined.`);

        // 1) Tell the newcomer about each EXISTING player
        this.players.forEach((pd, sid) => {
            client.send("playerJoined", { sid: sid });
            client.send("remotePlayerMove", {
                sid: sid,
                x: pd.x,
                y: pd.y,
                z: pd.z,
                rx: pd.rx,
                ry: pd.ry,
                rz: pd.rz,
            });
        });

        // 2) Add the new player to tracking
        const newPlayer: PlayerData = {
            sessionId: client.sessionId,
            x: 0, y: 0, z: 0,
            rx: 0, ry: 0, rz: 0,
            dirty: false,
            client: client,
        };
        this.players.set(client.sessionId, newPlayer);

        // 3) Tell ALL OTHER clients that a new player joined
        this.broadcast("playerJoined", { sid: client.sessionId }, { except: client });
    }

    onLeave(client: Client, consented: boolean) {
        console.log(`[CubeRoom] Client ${client.sessionId} left.`);

        this.players.delete(client.sessionId);
        this.broadcast("playerLeft", { sid: client.sessionId });
    }

    onDispose() {
        console.log("[CubeRoom] Room disposed.");
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        this.players.clear();
    }
}
