import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import type { User } from '../types';

type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'failed';

interface ActiveCall {
    partner: User;
}

interface IncomingCall {
    caller: User;
}

interface CallStateContextType {
    callState: CallState;
    activeCall: ActiveCall | null;
    incomingCall: IncomingCall | null;
    initiateCall: (partner: User) => void;
    acceptCall: () => void;
    rejectCall: () => void;
    endCall: () => void;
}

const CallStateContext = createContext<CallStateContextType | null>(null);

export const CallStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { socket } = useSocket();
    const [callState, setCallState] = useState<CallState>('idle');
    const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
    const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

    const resetState = useCallback(() => {
        setCallState('idle');
        setActiveCall(null);
        setIncomingCall(null);
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = ({ caller }: { caller: User }) => {
            if (callState === 'idle') {
                setIncomingCall({ caller });
                setCallState('incoming');
            } else {
                // If busy, automatically reject
                socket.emit('video:call-rejected', { targetId: caller.id });
            }
        };
        
        const handleCallAccepted = ({ senderId }: { senderId: string }) => {
            if (callState === 'outgoing' && activeCall?.partner.id === senderId) {
                setCallState('connected');
            }
        };

        const handleCallRejected = () => {
            resetState();
        };

        const handleCallEnded = () => {
            resetState();
        };

        socket.on('video:incoming-call', handleIncomingCall);
        socket.on('video:call-accepted', handleCallAccepted);
        socket.on('video:call-rejected', handleCallRejected);
        socket.on('video:call-ended', handleCallEnded);

        return () => {
            socket.off('video:incoming-call', handleIncomingCall);
            socket.off('video:call-accepted', handleCallAccepted);
            socket.off('video:call-rejected', handleCallRejected);
            socket.off('video:call-ended', handleCallEnded);
        };
    }, [socket, callState, activeCall, resetState]);

    const initiateCall = (partner: User) => {
        if (callState !== 'idle') return;
        setCallState('outgoing');
        setActiveCall({ partner });
        socket?.emit('video:call-request', { targetId: partner.id });
    };

    const acceptCall = () => {
        if (callState !== 'incoming' || !incomingCall) return;
        setActiveCall({ partner: incomingCall.caller });
        setCallState('connected');
        socket?.emit('video:call-accepted', { targetId: incomingCall.caller.id });
        setIncomingCall(null);
    };

    const rejectCall = () => {
        if (callState !== 'incoming' || !incomingCall) return;
        socket?.emit('video:call-rejected', { targetId: incomingCall.caller.id });
        resetState();
    };

    const endCall = () => {
        if (!activeCall) return;
        socket?.emit('video:call-ended', { targetId: activeCall.partner.id });
        resetState();
    };

    const value = { callState, activeCall, incomingCall, initiateCall, acceptCall, rejectCall, endCall };

    return (
        <CallStateContext.Provider value={value}>
            {children}
        </CallStateContext.Provider>
    );
};

export const useCallState = () => {
    const context = useContext(CallStateContext);
    if (!context) {
        throw new Error('useCallState must be used within a CallStateProvider');
    }
    return context;
};
