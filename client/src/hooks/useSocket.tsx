import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { initializeCallSystem } from './useCall';

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
    if (currentUser) {
      const newSocket = io({
        withCredentials: true,
      });

      setSocket(newSocket);
      initializeCallSystem(newSocket); // Initialize the call system with the new socket

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
