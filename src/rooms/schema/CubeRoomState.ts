/**
 * CubeRoomState.ts
 * 
 * Colyseus server-side schema for the synchronized cube room.
 * Install dependencies:
 *   npm init -y
 *   npm install colyseus @colyseus/tools
 * 
 * This defines the room state with a single CubeTransform object
 * that holds position (x,y,z) and rotation (rx,ry,rz) of the cube.
 */

import { Schema, type, MapSchema } from "@colyseus/schema";

/**
 * Represents the transform of the synchronized cube.
 */
export class CubeTransform extends Schema {
    @type("float32") x: number = 0;
    @type("float32") y: number = 0.5;   // Default Y so cube sits on ground
    @type("float32") z: number = 0;

    @type("float32") rx: number = 0;    // Rotation X (euler degrees)
    @type("float32") ry: number = 0;    // Rotation Y
    @type("float32") rz: number = 0;    // Rotation Z
}

/**
 * The main room state.
 * - cubeTransform: synchronized cube position & rotation
 * - hostSessionId: the session ID of the player who created (hosts) the room
 */
export class CubeRoomState extends Schema {
    @type(CubeTransform) cubeTransform: CubeTransform = new CubeTransform();
    @type("string") hostSessionId: string = "";
}
