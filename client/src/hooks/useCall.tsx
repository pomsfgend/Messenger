import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import type { User, CallState, CallPeer } from '../types';
import { useSocket } from './useSocket';
import { useAuth } from './useAuth';
import sodium from 'libsodium-wrappers';
import { v4 as uuidv4 } from 'uuid';
import { clientConfig } from '../config';
import * as api from '../services/api';

interface CallContextType {
    callState: CallState;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    caller: User | null;
    callee: User | null;
    initiateCall: (callee: User) => Promise<void>;
    acceptCall: () => Promise<void>;
    rejectCall: () => void;
    endCall: () => void;
    isLocalAudioMuted: boolean;
    isLocalVideoMuted: boolean;
    toggleLocalAudio: () => void;
    toggleLocalVideo: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { socket } = useSocket();
    const { currentUser } = useAuth();
    
    const [callState, setCallState] = useState<CallState>('idle');
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [caller, setCaller] = useState<User | null>(null);
    const [callee, setCallee] = useState<User | null>(null);
    const [isLocalAudioMuted, setLocalAudioMuted] = useState(false);
    const [isLocalVideoMuted, setLocalVideoMuted] = useState(false);
    
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const myKeys = useRef<sodium.KeyPair | null>(null);
    const myTempId = useRef<string | null>(null);
    const currentCallId = useRef<string | null>(null);
    const peer = useRef<CallPeer | null>(null);

    const cleanup = useCallback(() => {
        if (peerConnection.current) {
            peerConnection.current.ontrack = null;
            peerConnection.current.onicecandidate = null;
            peerConnection.current.close();
            peerConnection.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        setLocalStream(null);
        setRemoteStream(null);
        setCaller(null);
        setCallee(null);
        setCallState('idle');
        currentCallId.current = null;
        peer.current = null;
    }, [localStream]);

    useEffect(() => {
        if (!socket || !currentUser) {
            cleanup();
            return;
        };

        const register = async () => {
            if (!myKeys.current) {
                myKeys.current = sodium.crypto_box_keypair();
            }
            socket.emit('call:register', { publicKey: myKeys.current.publicKey });
        }
        
        socket.on('connect', register);
        if(socket.connected) register();

        socket.on('call:registered', ({ tempId }) => {
            myTempId.current = tempId;
        });

        socket.on('call:incoming', async ({ callId, callerTempId, callerPublicKey, callerInfo }) => {
            if (callState !== 'idle') {
                // Already in a call, reject automatically
                socket.emit('call:reject', { callId, targetTempId: callerTempId });
                return;
            }
            currentCallId.current = callId;
            peer.current = { userId: callerInfo.id, tempId: callerTempId, publicKey: new Uint8Array(callerPublicKey) };
            setCaller(callerInfo);
            setCallState('incoming');
        });

        socket.on('call:accepted', ({ callId, calleeTempId, calleePublicKey }) => {
            if(currentCallId.current !== callId) return;
            peer.current = { userId: callee!.id, tempId: calleeTempId, publicKey: new Uint8Array(calleePublicKey) };
            createOffer();
        });

        socket.on('call:signal', async ({ type, data, senderTempId }) => {
            if (!myKeys.current || !peer.current) return;
            
            try {
                const decryptedData = sodium.crypto_box_seal_open(
                    new Uint8Array(data),
                    myKeys.current.publicKey,
                    myKeys.current.privateKey
                );
                const signal = JSON.parse(new TextDecoder().decode(decryptedData));

                if (type === 'offer') {
                    if (!peerConnection.current) await createPeerConnection();
                    await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(signal));
                    const answer = await peerConnection.current!.createAnswer();
                    await peerConnection.current!.setLocalDescription(answer);

                    const encryptedAnswer = sodium.crypto_box_seal(
                        new TextEncoder().encode(JSON.stringify(answer)),
                        peer.current.publicKey
                    );
                    socket.emit('call:signal', { type: 'answer', targetTempId: senderTempId, data: Array.from(encryptedAnswer), callId: currentCallId.current });
                
                } else if (type === 'answer') {
                    await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(signal));
                
                } else if (type === 'candidate') {
                    await peerConnection.current!.addIceCandidate(new RTCIceCandidate(signal));
                }

            } catch (e) {
                console.error("Decryption or signaling error:", e);
                endCall();
            }
        });

        socket.on('call:rejected', cleanup);
        socket.on('call:ended', cleanup);

        return () => {
            socket.off('connect', register);
            socket.off('call:registered');
            socket.off('call:incoming');
            socket.off('call:accepted');
            socket.off('call:signal');
            socket.off('call:rejected');
            socket.off('call:ended');
        }

    }, [socket, currentUser, callState, callee, cleanup]);

    const getTurnCredentials = async () => {
        try {
            const credentials = await api.getTurnCredentials();
            if (!credentials.urls) {
                console.warn("TURN server URL not provided by server. P2P connection will be attempted.");
                return undefined;
            }
            return credentials;
        } catch (error) {
            console.error("Failed to fetch TURN credentials, calls may not work across different networks.", error);
            return {
                urls: clientConfig.TURN_SERVER_URL,
            };
        }
    };

    const createPeerConnection = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);

            const iceServer = await getTurnCredentials();
            
            const pc = new RTCPeerConnection({
                iceServers: iceServer ? [iceServer] : [],
                iceTransportPolicy: 'relay'
            });

            pc.onicecandidate = (event) => {
                if (event.candidate && peer.current && myKeys.current) {
                    const encryptedCandidate = sodium.crypto_box_seal(
                        new TextEncoder().encode(JSON.stringify(event.candidate)),
                        peer.current.publicKey
                    );
                    socket?.emit('call:signal', {
                        type: 'candidate',
                        targetTempId: peer.current.tempId,
                        data: Array.from(encryptedCandidate),
                        callId: currentCallId.current
                    });
                }
            };

            pc.ontrack = (event) => {
                setRemoteStream(event.streams[0]);
            };

            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            peerConnection.current = pc;
            setCallState('connected');

        } catch (e) {
            console.error("Failed to create peer connection:", e);
            setCallState('error');
            cleanup();
        }
    };

    const createOffer = async () => {
        if (!peer.current || !myKeys.current) return;
        await createPeerConnection();
        const offer = await peerConnection.current!.createOffer();
        await peerConnection.current!.setLocalDescription(offer);

        const encryptedOffer = sodium.crypto_box_seal(
            new TextEncoder().encode(JSON.stringify(offer)),
            peer.current.publicKey
        );
        socket?.emit('call:signal', { type: 'offer', targetTempId: peer.current.tempId, data: Array.from(encryptedOffer), callId: currentCallId.current });
    };

    const initiateCall = async (calleeUser: User) => {
        if (callState !== 'idle' || !socket || !myTempId.current) return;
        setCallee(calleeUser);
        setCallState('outgoing');
        currentCallId.current = uuidv4();
        socket.emit('call:initiate', { calleeId: calleeUser.id, callId: currentCallId.current });
    };

    const acceptCall = async () => {
        if (callState !== 'incoming' || !socket || !peer.current) return;
        socket.emit('call:accept', { callId: currentCallId.current, targetTempId: peer.current.tempId });
    };

    const rejectCall = () => {
        if (socket && (callState === 'incoming' || callState === 'outgoing')) {
            socket.emit('call:reject', { callId: currentCallId.current, targetTempId: peer.current?.tempId });
        }
        cleanup();
    };

    const endCall = () => {
        if (socket) {
             socket.emit('call:end', { callId: currentCallId.current, targetTempId: peer.current?.tempId });
        }
        cleanup();
    };

    const toggleLocalAudio = () => {
        localStream?.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
            setLocalAudioMuted(!track.enabled);
        });
    };
    
    const toggleLocalVideo = () => {
        localStream?.getVideoTracks().forEach(track => {
            track.enabled = !track.enabled;
            setLocalVideoMuted(!track.enabled);
        });
    };


    const value = {
        callState, localStream, remoteStream, caller, callee, initiateCall, acceptCall, rejectCall, endCall,
        isLocalAudioMuted, isLocalVideoMuted, toggleLocalAudio, toggleLocalVideo,
    };

    return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCall must be used within a CallProvider');
    }
    return context;
};