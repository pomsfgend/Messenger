import { useState, useEffect, useCallback, useRef, RefObject } from 'react';
import { useSocket } from './useSocket';
import * as api from '../services/api';
import { User } from '../types';
import { useAuth } from './useAuth';

interface UseCallProps {
    localVideoRef: RefObject<HTMLVideoElement>;
    remoteVideoRef: RefObject<HTMLVideoElement>;
    chatId: string | null;
}

interface IncomingCall {
    caller: User;
    offer: RTCSessionDescriptionInit;
}

const E2EE_KEY_CONTEXT = 'bulkhead-e2ee-key';
const IV_LENGTH = 12; // Recommended for AES-GCM

const supportsInsertableStreams = () => {
  return (
    typeof RTCRtpSender !== 'undefined' &&
    'createEncodedStreams' in RTCRtpSender.prototype
  );
};

const getMasterKey = async (chatId: string): Promise<Uint8Array> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(chatId);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash);
};

const deriveKey = async (masterKey: Uint8Array, info: string): Promise<CryptoKey> => {
    const key = await crypto.subtle.importKey('raw', masterKey, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new TextEncoder().encode('bulkhead-salt'), // A static salt is acceptable for HKDF
            info: new TextEncoder().encode(info),
        },
        key,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
};

export const useCall = ({ localVideoRef, remoteVideoRef, chatId }: UseCallProps) => {
    const { socket } = useSocket();
    const { currentUser } = useAuth();
    const [inCall, setInCall] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const callPartnerRef = useRef<User | null>(null);
    const encryptionKeys = useRef<{ sendKey: CryptoKey, receiveKey: CryptoKey } | null>(null);

    const createPeerConnection = useCallback(async () => {
        try {
            const iceServers = await api.getTurnCredentials();
            const pc = new RTCPeerConnection({
                iceServers,
                iceTransportPolicy: 'relay', // Force TURN for privacy
            });
            
            pc.onicecandidate = (event) => {
                if (event.candidate && socket && callPartnerRef.current) {
                    socket.emit('webrtc:ice-candidate', {
                        to: callPartnerRef.current.id,
                        candidate: event.candidate,
                    });
                }
            };
            
            pc.ontrack = (event) => {
                remoteStreamRef.current = event.streams[0];
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStreamRef.current;
                }
            };

            peerConnectionRef.current = pc;
            return pc;
        } catch (error) {
            console.error("Failed to create peer connection:", error);
            return null;
        }
    }, [socket, remoteVideoRef]);

    const setupE2EE = useCallback(async (pc: RTCPeerConnection, isInitiator: boolean) => {
        if (!supportsInsertableStreams()) {
            console.warn("Using frame encryption fallback: End-to-end encryption is not supported by this browser. Call will not be encrypted.");
            return;
        }
        if (!chatId) throw new Error("ChatID is required for E2EE key derivation.");
        
        const masterKey = await getMasterKey(chatId);
        
        // Derive separate keys for sending and receiving based on the call initiator
        const sendKeyInfo = isInitiator ? `${E2EE_KEY_CONTEXT}-sender` : `${E2EE_KEY_CONTEXT}-receiver`;
        const receiveKeyInfo = isInitiator ? `${E2EE_KEY_CONTEXT}-receiver` : `${E2EE_KEY_CONTEXT}-sender`;

        const [sendKey, receiveKey] = await Promise.all([
            deriveKey(masterKey, sendKeyInfo),
            deriveKey(masterKey, receiveKeyInfo),
        ]);
        encryptionKeys.current = { sendKey, receiveKey };
        
        const transceivers = pc.getTransceivers();
        for (const transceiver of transceivers) {
            if (transceiver.sender.track && transceiver.receiver.track) {
                const senderStreams = (transceiver.sender as any).createEncodedStreams();
                const receiverStreams = (transceiver.receiver as any).createEncodedStreams();

                // Encrypt outgoing stream
                senderStreams.readable
                    .pipeThrough(new TransformStream({
                        transform: async (encodedFrame, controller) => {
                            const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
                            const encryptedData = await crypto.subtle.encrypt(
                                { name: 'AES-GCM', iv },
                                encryptionKeys.current!.sendKey,
                                encodedFrame.data
                            );
                            const newPacket = new Uint8Array(iv.length + encryptedData.byteLength);
                            newPacket.set(iv, 0);
                            newPacket.set(new Uint8Array(encryptedData), iv.length);
                            encodedFrame.data = newPacket.buffer;
                            controller.enqueue(encodedFrame);
                        }
                    }))
                    .pipeTo(senderStreams.writable);

                // Decrypt incoming stream
                receiverStreams.readable
                    .pipeThrough(new TransformStream({
                        transform: async (encodedFrame, controller) => {
                            try {
                                const packet = new Uint8Array(encodedFrame.data);
                                const iv = packet.slice(0, IV_LENGTH);
                                const ciphertext = packet.slice(IV_LENGTH);
                                const decryptedData = await crypto.subtle.decrypt(
                                    { name: 'AES-GCM', iv },
                                    encryptionKeys.current!.receiveKey,
                                    ciphertext
                                );
                                encodedFrame.data = decryptedData;
                                controller.enqueue(encodedFrame);
                            } catch (e) {
                                console.error("Decryption failed:", e);
                                // Don't enqueue frames that fail to decrypt
                            }
                        }
                    }))
                    .pipeTo(receiverStreams.writable);
            }
        }
    }, [chatId]);


    const startCall = useCallback(async (partner: User) => {
        if (!socket || !currentUser) return;

        callPartnerRef.current = partner;
        const pc = await createPeerConnection();
        if (!pc) return;
        
        try {
            localStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err) {
            console.error("Failed to get user media", err);
            return;
        }
        
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
        
        // CORRECT ORDER: Setup E2EE before creating the offer.
        await setupE2EE(pc, true);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('call:start', {
            to: partner.id,
            from: currentUser,
            offer,
        });

        setInCall(true);
    }, [socket, currentUser, createPeerConnection, localVideoRef, setupE2EE]);
    
    const endCall = useCallback(() => {
        if (socket && callPartnerRef.current) {
            socket.emit('call:end', { to: callPartnerRef.current.id });
        }
        
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        
        setInCall(false);
        callPartnerRef.current = null;
        setIncomingCall(null);
    }, [socket]);

    const rejectCall = useCallback(() => {
        if (socket && incomingCall) {
            socket.emit('call:reject', { to: incomingCall.caller.id });
        }
        setIncomingCall(null);
    }, [socket, incomingCall]);

    const acceptCall = useCallback(async () => {
        if (!socket || !currentUser || !incomingCall) return;

        callPartnerRef.current = incomingCall.caller;
        const pc = await createPeerConnection();
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
        
        try {
            localStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch(err) {
            console.error("Failed to get user media for answer", err);
            rejectCall();
            return;
        }

        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
        
        // CORRECT ORDER: Setup E2EE for the answering client before creating the answer.
        await setupE2EE(pc, false);
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.emit('webrtc:answer', {
            to: incomingCall.caller.id,
            answer,
        });
        
        setInCall(true);
        setIncomingCall(null);
    }, [socket, currentUser, incomingCall, createPeerConnection, localVideoRef, setupE2EE, rejectCall]);

    const toggleMic = () => {
        localStreamRef.current?.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
            setIsMuted(!track.enabled);
        });
    };

    const toggleCamera = () => {
        localStreamRef.current?.getVideoTracks().forEach(track => {
            track.enabled = !track.enabled;
            setIsCameraOff(!track.enabled);
        });
    };

    useEffect(() => {
        if (!socket) return;
        
        const handleIncomingCall = (data: { from: User, offer: RTCSessionDescriptionInit }) => {
            if (inCall) { // If already in a call, auto-reject
                socket.emit('call:reject', { to: data.from.id, reason: 'busy' });
                return;
            }
            setIncomingCall({ caller: data.from, offer: data.offer });
        };
        
        const handleAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
            if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
        };

        const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
            if (peerConnectionRef.current && data.candidate) {
                try {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                    console.error("Error adding received ICE candidate", e);
                }
            }
        };

        socket.on('call:incoming', handleIncomingCall);
        socket.on('webrtc:answer', handleAnswer);
        socket.on('webrtc:ice-candidate', handleIceCandidate);
        socket.on('call:end', endCall);
        socket.on('call:rejected', () => { endCall(); });

        return () => {
            socket.off('call:incoming', handleIncomingCall);
            socket.off('webrtc:answer', handleAnswer);
            socket.off('webrtc:ice-candidate', handleIceCandidate);
            socket.off('call:end', endCall);
            socket.off('call:rejected');
        };
    }, [socket, inCall, endCall]);

    return {
        inCall,
        isMuted,
        isCameraOff,
        incomingCall,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMic,
        toggleCamera,
    };
};