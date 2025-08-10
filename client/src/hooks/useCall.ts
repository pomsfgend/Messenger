import { useState, useRef, useEffect, useCallback, RefObject } from "react";
import { useSocket } from "./useSocket";
import * as api from '../services/api';
import { User } from "../types";

interface UseCallProps {
    localVideoRef: RefObject<HTMLVideoElement>;
    remoteVideoRef: RefObject<HTMLVideoElement>;
    chatId: string | null;
}

export const useCall = ({ localVideoRef, remoteVideoRef, chatId }: UseCallProps) => {
    const { socket } = useSocket();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'in-call' | 'failed' | 'incoming'>("idle");
    const [peer, setPeer] = useState<User | null>(null);
    const [incomingCall, setIncomingCall] = useState<{ caller: User, offer: RTCSessionDescriptionInit } | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    const endCallCleanup = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setRemoteStream(null);
        setCallStatus("idle");
        setPeer(null);
        setIncomingCall(null);
        setIsMuted(false);
        setIsCameraOff(false);
    }, [localStream, localVideoRef, remoteVideoRef]);

    const setupPeerConnection = useCallback(async (peerId: string) => {
        const iceServers = await api.getTurnCredentials();
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate && peerId && socket) {
                socket.emit('webrtc:ice-candidate', { to: peerId, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
                endCallCleanup();
            }
        };

        return pc;
    }, [socket, remoteVideoRef, endCallCleanup]);

    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = async (data: { from: string, offer: RTCSessionDescriptionInit }) => {
            const callerProfile = await api.getProfileByUniqueId(data.from);
            setIncomingCall({ caller: callerProfile, offer: data.offer });
            setPeer(callerProfile);
            setCallStatus('incoming');
        };

        const handleAnswer = (data: { answer: RTCSessionDescriptionInit }) => {
            if (pcRef.current && pcRef.current.signalingState !== 'stable') {
                pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                setCallStatus('in-call');
            }
        };

        const handleIceCandidate = (data: { candidate: RTCIceCandidateInit }) => {
            if (pcRef.current && data.candidate) {
                pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
            }
        };

        const handleCallRejected = () => {
            endCallCleanup();
        };

        const handleCallEnd = () => {
            endCallCleanup();
        };

        socket.on('call:incoming', handleIncomingCall);
        socket.on('webrtc:answer', handleAnswer);
        socket.on('webrtc:ice-candidate', handleIceCandidate);
        socket.on('call:rejected', handleCallRejected);
        socket.on('call:end', handleCallEnd);

        return () => {
            socket.off('call:incoming', handleIncomingCall);
            socket.off('webrtc:answer', handleAnswer);
            socket.off('webrtc:ice-candidate', handleIceCandidate);
            socket.off('call:rejected', handleCallRejected);
            socket.off('call:end', handleCallEnd);
        };
    }, [socket, endCallCleanup]);

    const startCall = useCallback(async (peerToCall: User) => {
        if (!socket) return;
        setPeer(peerToCall);
        setCallStatus('calling');
        try {
            const pc = await setupPeerConnection(peerToCall.id);
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const currentUser = await api.checkSession();
            socket.emit('call:start', { to: peerToCall.id, from: currentUser, offer });

        } catch (err) {
            console.error("Failed to start call:", err);
            setCallStatus("failed");
            endCallCleanup();
        }
    }, [socket, setupPeerConnection, localVideoRef, endCallCleanup]);

    const acceptCall = useCallback(async () => {
        if (!socket || !incomingCall || !peer) return;
        setCallStatus('in-call');
        try {
            const pc = await setupPeerConnection(peer.id);
            await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc:answer', { to: peer.id, answer });

            setIncomingCall(null);
        } catch (err) {
            console.error("Failed to answer call:", err);
            setCallStatus("failed");
            endCallCleanup();
        }
    }, [socket, incomingCall, peer, setupPeerConnection, localVideoRef, endCallCleanup]);

    const rejectCall = useCallback(() => {
        if (socket && peer) {
            socket.emit('call:reject', { to: peer.id, reason: 'rejected' });
        }
        endCallCleanup();
    }, [socket, peer, endCallCleanup]);

    const endCall = useCallback(() => {
        if (socket && peer) {
            socket.emit('call:end', { to: peer.id });
        }
        endCallCleanup();
    }, [socket, peer, endCallCleanup]);

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(prev => !prev);
        }
    };

    const toggleCamera = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsCameraOff(prev => !prev);
        }
    };

    return {
        callStatus,
        localStream,
        remoteStream,
        isMuted,
        isCameraOff,
        incomingCall,
        peer,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
    };
};
