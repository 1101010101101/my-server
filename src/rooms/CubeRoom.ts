/**
 * CubeRoom.ts
 *
 * Colyseus Room definition.
 * Handles:
 *   - Legacy cube sync ("moveCube" messages)
 *   - Multiplayer player characters ("playerMove" messages)
 *
 * Player flow:
 *   1. Client joins → server tracks them, broadcasts "playerJoined" to others,
 *      sends "existingPlayers" list to the newcomer.
 *   2. Client sends "playerMove" → server stores their latest transform,
 *      broadcasts it to ALL OTHER clients as "remotePlayerMove".
 *   3. Client leaves → server broadcasts "playerLeft" to remaining clients.
 *
 * We intentionally do NOT sync camera or KCC internal state.
 * Only position (x,y,z) and rotation (rx,ry,rz) are synchronized.
 */

import { Room, Client } from "colyseus";

// Simple interface to track each player's last-known transform
interface PlayerData {
    sessionId: string;
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
}

export class CubeRoom extends Room {

    /** Maximum clients per room */
    maxClients = 10;

    /** Map of sessionId → last-known player transform */
    private players: Map<string, PlayerData> = new Map();

    onCreate(options: any) {
        console.log("[CubeRoom] Room created!", this.roomId);

        // -----------------------------------------------------------------
        // Legacy: "moveCube" — broadcasts cube position to all OTHER clients
        // -----------------------------------------------------------------
        this.onMessage("moveCube", (client: Client, data: any) => {
            // Broadcast to everyone EXCEPT the sender
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
        // Client sends their position+rotation, server stores and relays.
        // -----------------------------------------------------------------
        this.onMessage("playerMove", (client: Client, data: any) => {
            const sid = client.sessionId;

            // Update stored transform
            const pd = this.players.get(sid);
            if (pd) {
                pd.x  = data.x  ?? pd.x;
                pd.y  = data.y  ?? pd.y;
                pd.z  = data.z  ?? pd.z;
                pd.rx = data.rx ?? pd.rx;
                pd.ry = data.ry ?? pd.ry;
                pd.rz = data.rz ?? pd.rz;
            }

            // Broadcast to everyone EXCEPT the sender
            this.broadcast("remotePlayerMove", {
                sid: sid,
                x: data.x,
                y: data.y,
                z: data.z,
                rx: data.rx,
                ry: data.ry,
                rz: data.rz,
            }, { except: client });
        });

        // Make this room visible in the lobby
        this.setMetadata({ name: options.roomName || "Game Room" });
    }

    onJoin(client: Client, options: any) {
        console.log(`[CubeRoom] Client ${client.sessionId} joined.`);

        // Create player data with a default spawn position
        const newPlayer: PlayerData = {
            sessionId: client.sessionId,
            x: 0,
            y: 0,
            z: 0,
            rx: 0,
            ry: 0,
            rz: 0,
        };
        this.players.set(client.sessionId, newPlayer);

        // 1) Tell the NEW client about ALL existing players (excluding themselves)
        const existingList: PlayerData[] = [];
        this.players.forEach((pd, sid) => {
            if (sid !== client.sessionId) {
                existingList.push(pd);
            }
        });
        client.send("existingPlayers", { players: existingList });

        // 2) Tell ALL OTHER clients that a new player joined
        this.broadcast("playerJoined", { sid: client.sessionId }, { except: client });
    }

    onLeave(client: Client, consented: boolean) {
        console.log(`[CubeRoom] Client ${client.sessionId} left.`);

        // Remove from tracking
        this.players.delete(client.sessionId);

        // Notify remaining clients
        this.broadcast("playerLeft", { sid: client.sessionId });
    }

    onDispose() {
        console.log("[CubeRoom] Room disposed.");
        this.players.clear();
    }
}
