import { Server } from 'socket.io';

let io: Server;

/**
 * A shared set containing the user IDs of all currently connected clients.
 * This is the single source of truth for online status.
 */
export const onlineUsers = new Set<string>();

/**
 * Sets the global Socket.IO server instance.
 * Should be called once during server initialization.
 * @param {Server} socketIo - The Socket.IO server instance.
 */
export const setIo = (socketIo: Server) => {
    io = socketIo;
};

/**
 * Retrieves the global Socket.IO server instance.
 * @returns {Server} The Socket.IO server instance.
 * @throws {Error} If the instance has not been initialized.
 */
export const getIo = (): Server => {
    if (!io) {
        throw new Error('Socket.IO has not been initialized. Call setIo first.');
    }
    return io;
};