/**
 * CubeRoom.ts
 *
 * Colyseus Room with:
 *   - Tick-based player position batching (30 Hz)
 *   - WebRTC signaling relay for P2P connections
 *   - Fallback server relay for position sync
 */

import { Room, Client } from "colyseus";

interface PlayerData {
    sessionId: string;
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
    dirty: boolean;
    client: Client;
}

const TICK_RATE = 30;

export class CubeRoom extends Room {

    maxClients = 10;
    private players: Map<string, PlayerData> = new Map();
    private tickInterval: ReturnType<typeof setInterval> | null = null;

    onCreate(options: any) {
        console.log("[CubeRoom] Room created!", this.roomId);

        // -----------------------------------------------------------------
        // Legacy cube sync
        // -----------------------------------------------------------------
        this.onMessage("moveCube", (client: Client, data: any) => {
            this.broadcast("moveCube", {
                sid: client.sessionId,
                x: data.x, y: data.y, z: data.z,
                rx: data.rx, ry: data.ry, rz: data.rz,
            }, { except: client });
        });

        // -----------------------------------------------------------------
        // Player position sync (server relay fallback)
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
        // WebRTC Signaling — relay between specific peers
        // -----------------------------------------------------------------

        // SDP Offer: sender → server → target peer
        this.onMessage("webrtc-offer", (client: Client, data: any) => {
            const target = this.players.get(data.target);
            if (target) {
                target.client.send("webrtc-offer", {
                    from: client.sessionId,
                    sdp: data.sdp,
                });
            }
        });

        // SDP Answer: responder → server → initiator
        this.onMessage("webrtc-answer", (client: Client, data: any) => {
            const target = this.players.get(data.target);
            if (target) {
                target.client.send("webrtc-answer", {
                    from: client.sessionId,
                    sdp: data.sdp,
                });
            }
        });

        // ICE Candidate: relay to specific peer
        this.onMessage("webrtc-ice", (client: Client, data: any) => {
            const target = this.players.get(data.target);
            if (target) {
                target.client.send("webrtc-ice", {
                    from: client.sessionId,
                    candidate: data.candidate,
                    sdpMid: data.sdpMid,
                    sdpMLineIndex: data.sdpMLineIndex,
                });
            }
        });

        // -----------------------------------------------------------------
        // Tick loop
        // -----------------------------------------------------------------
        this.tickInterval = setInterval(() => this.tick(), 1000 / TICK_RATE);
        this.setMetadata({ name: options.roomName || "Game Room" });
    }

    private tick() {
        this.players.forEach((pd) => {
            if (!pd.dirty) return;
            pd.dirty = false;
            this.broadcast("remotePlayerMove", {
                sid: pd.sessionId,
                x: pd.x, y: pd.y, z: pd.z,
                rx: pd.rx, ry: pd.ry, rz: pd.rz,
            }, { except: pd.client });
        });
    }

    onJoin(client: Client, options: any) {
        console.log(`[CubeRoom] Client ${client.sessionId} joined.`);

        // Tell newcomer about existing players
        this.players.forEach((pd, sid) => {
            client.send("playerJoined", { sid });
            client.send("remotePlayerMove", {
                sid, x: pd.x, y: pd.y, z: pd.z,
                rx: pd.rx, ry: pd.ry, rz: pd.rz,
            });
        });

        // Add new player
        this.players.set(client.sessionId, {
            sessionId: client.sessionId,
            x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
            dirty: false, client,
        });

        // Tell others
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
