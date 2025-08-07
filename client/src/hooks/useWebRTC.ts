import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './useSocket';
import * as api from '../services/api';
import { turnServerConfig } from '../turnConfig';
import type { User } from '../types';

export const useWebRTC = (partner: User, onConnectionStateChange: (state: RTCIceConnectionState) => void) => {
    const { socket } = useSocket();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const isCallerRef = useRef(false);

    const initializeMedia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: true,
            });
            setLocalStream(stream);
            return stream;
        } catch (error) {
            console.error("Error accessing media devices.", error);
            // Handle error (e.g., show a message to the user)
            return null;
        }
    }, []);

    const createPeerConnection = useCallback(async (stream: MediaStream) => {
        const turnCredentials = await api.getTurnCredentials();
        const iceServers = [{
            ...turnServerConfig,
            username: turnCredentials.username,
            credential: turnCredentials.credential,
        }];

        const pc = new RTCPeerConnection({
            iceServers,
            iceTransportPolicy: 'relay', // Force TURN relay for anonymity
        });

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket?.emit('video:ice-candidate', {
                    targetId: partner.id,
                    candidate: event.candidate,
                });
            }
        };
        
        pc.oniceconnectionstatechange = () => {
            onConnectionStateChange(pc.iceConnectionState);
        };

        peerConnectionRef.current = pc;
    }, [socket, partner.id, onConnectionStateChange]);

    // Cleanup function
    const closeConnection = useCallback(() => {
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        localStream?.getTracks().forEach(track => track.stop());
        setLocalStream(null);
        setRemoteStream(null);
    }, [localStream]);

    // Effect for handling signaling messages from socket
    useEffect(() => {
        if (!socket || !peerConnectionRef.current) return;

        const pc = peerConnectionRef.current;
        
        const handleOffer = async (data: { senderId: string, offer: RTCSessionDescriptionInit }) => {
            if (data.senderId !== partner.id) return;
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('video:answer', { targetId: partner.id, answer });
        };

        const handleAnswer = (data: { senderId: string, answer: RTCSessionDescriptionInit }) => {
            if (data.senderId !== partner.id) return;
            pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        };

        const handleIceCandidate = (data: { senderId: string, candidate: RTCIceCandidateInit }) => {
            if (data.senderId !== partner.id) return;
            pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        };
        
        socket.on('video:offer', handleOffer);
        socket.on('video:answer', handleAnswer);
        socket.on('video:ice-candidate', handleIceCandidate);

        return () => {
            socket.off('video:offer', handleOffer);
            socket.off('video:answer', handleAnswer);
            socket.off('video:ice-candidate', handleIceCandidate);
        };
    }, [socket, partner.id]);

    const startCall = useCallback(async () => {
        isCallerRef.current = true;
        const stream = await initializeMedia();
        if (stream) {
            await createPeerConnection(stream);
            const pc = peerConnectionRef.current;
            if (pc) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket?.emit('video:offer', { targetId: partner.id, offer });
            }
        }
    }, [initializeMedia, createPeerConnection, socket, partner.id]);

    const answerCall = useCallback(async () => {
        isCallerRef.current = false;
        const stream = await initializeMedia();
        if (stream) {
            await createPeerConnection(stream);
        }
    }, [initializeMedia, createPeerConnection]);

    const toggleAudio = (enabled: boolean) => {
        localStream?.getAudioTracks().forEach(track => track.enabled = enabled);
    };

    const toggleVideo = (enabled: boolean) => {
        localStream?.getVideoTracks().forEach(track => track.enabled = enabled);
    };

    return { localStream, remoteStream, startCall, answerCall, closeConnection, toggleAudio, toggleVideo };
};
