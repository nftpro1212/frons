// src/frontend/src/hooks/useSocket.js
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function useSocket() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const apiURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const socketURL =
      import.meta.env.VITE_SOCKET_URL || apiURL.replace(/\/api\/?$/, "");

    const socketInstance = io(socketURL, {
      transports: ["websocket"],
      reconnection: true,
    });

    setSocket(socketInstance);

    return () => socketInstance.disconnect();
  }, []);

  return socket;
}
