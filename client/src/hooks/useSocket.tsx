
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Only establish a connection if there's a logged-in user.
    // The dependency array `[!!currentUser]` ensures this effect only re-runs
    // when the user logs in or logs out, not on every profile data change.
    // This is a CRITICAL FIX to prevent constant reconnections.
    if (currentUser) {
      const newSocket = io({
        withCredentials: true,
      });

      setSocket(newSocket);

      // Clean up the connection when the component unmounts or user logs out.
      return () => {
        newSocket.disconnect();
      };
    } else {
      // If there's no user, ensure any existing socket is disconnected.
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!currentUser]); 

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};