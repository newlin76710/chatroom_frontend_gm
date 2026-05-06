import { io } from "socket.io-client";
import { BACKEND } from "./roomConfig";

let globalSocket = null;
if (!globalSocket) {
  globalSocket = io(BACKEND, {
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}

export default globalSocket;
