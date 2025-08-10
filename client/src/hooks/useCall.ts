import React, { useState, useEffect, useCallback, RefObject } from "react";
import { useSocket } from "./useSocket";
import * as api from '../services/api';
import { User } from "../types";
import toast from "react-hot-toast";

// --- STATE MANAGEMENT (Vanilla store with listeners) ---

interface CallState {
    callStatus: 'idle' | 'calling' | 'in-call' | 'failed' | 'incoming';
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isMuted: boolean;
    isCameraOff: boolean;
    peer: User | null;
    incomingCall: { caller: User; offer: RTCSessionDescriptionInit } | null;
}

const initialState: CallState = {
    callStatus: 'idle',
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isCameraOff: false,
    peer: null,
    incomingCall: null,
};

let state = { ...initialState };
const listeners = new Set<(state: CallState) => void>();

const setState = (updater: (prevState: CallState) => CallState) => {
    state = updater(state);
    listeners.forEach(listener => listener(state));
};

export const useCallState = () => {
    const [currentState, setCurrentState] = useState(state);
    useEffect(() => {
        const listener = (newState: CallState) => setCurrentState(newState);
        listeners.add(listener);
        // Sync state on mount
        listener(state); 
        return () => {
            listeners.delete(listener);
        };
    }, []);
    return currentState;
};

// --- REFS AND PEER CONNECTION ---

let localVideoRef: RefObject<HTMLVideoElement> | null = null;
let remoteVideoRef: RefObject<HTMLVideoElement> | null = null;
let pcRef: RTCPeerConnection | null = null;
let socketInstance: ReturnType<typeof useSocket>['socket'] = null;

export const initializeCallSystem = (socket: ReturnType<typeof useSocket>['socket']) => {
    if (socket && !socketInstance) {
        socketInstance = socket;
        setupSocketListeners();
    }
};

export const setVideoRefs = (refs: { local: RefObject<HTMLVideoElement>, remote: RefObject<HTMLVideoElement> }) => {
    localVideoRef = refs.local;
    remoteVideoRef = refs.remote;
};

// --- ACTIONS ---

const endCallCleanup = () => {
    if (pcRef) {
        pcRef.close();
        pcRef = null;
    }
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
    }
    if (localVideoRef?.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef?.current) remoteVideoRef.current.srcObject = null;
    
    setState(() => initialState);
};

const setupPeerConnection = async (peerId: string) => {
    const iceServers = await api.getTurnCredentials();
    const pc = new RTCPeerConnection({ iceServers });
    pcRef = pc;

    pc.onicecandidate = (event) => {
        if (event.candidate && peerId && socketInstance) {
            socketInstance.emit('webrtc:ice-candidate', { to: peerId, candidate: event.candidate });
        }
    };

    pc.ontrack = (event) => {
        if (remoteVideoRef?.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
        }
        setState(s => ({ ...s, remoteStream: event.streams[0] }));
    };

    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
            endCallCleanup();
        }
    };
    return pc;
};

export const startCall = async (peerToCall: User) => {
    if (!socketInstance) return;
    setState(s => ({ ...s, peer: peerToCall, callStatus: 'calling' }));
    try {
        const pc = await setupPeerConnection(peerToCall.id);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

        if (localVideoRef?.current) {
            localVideoRef.current.srcObject = stream;
        }
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        setState(s => ({ ...s, localStream: stream }));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const currentUser = await api.checkSession();
        socketInstance.emit('call:start', { to: peerToCall.id, from: currentUser, offer });

    } catch (err) {
        console.error("Failed to start call:", err);
        setState(s => ({ ...s, callStatus: "failed" }));
        endCallCleanup();
    }
};

export const acceptCall = async () => {
    if (!socketInstance || !state.incomingCall || !state.peer) return;

    setState(s => ({ ...s, callStatus: 'in-call', incomingCall: null }));
    try {
        const pc = await setupPeerConnection(state.peer.id);
        await pc.setRemoteDescription(new RTCSessionDescription(state.incomingCall.offer));

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef?.current) {
            localVideoRef.current.srcObject = stream;
        }
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        setState(s => ({ ...s, localStream: stream }));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketInstance.emit('webrtc:answer', { to: state.peer.id, answer });

    } catch (err) {
        console.error("Failed to answer call:", err);
        setState(s => ({ ...s, callStatus: "failed" }));
        endCallCleanup();
    }
};

export const rejectCall = () => {
    if (socketInstance && state.peer) {
        socketInstance.emit('call:reject', { to: state.peer.id, reason: 'rejected' });
    }
    endCallCleanup();
};

export const endCall = () => {
    if (socketInstance && state.peer) {
        socketInstance.emit('call:end', { to: state.peer.id });
    }
    endCallCleanup();
};

export const toggleMute = () => {
    if (state.localStream) {
        const isCurrentlyMuted = state.isMuted;
        state.localStream.getAudioTracks().forEach(track => track.enabled = isCurrentlyMuted);
        setState(s => ({ ...s, isMuted: !isCurrentlyMuted }));
    }
};

export const toggleCamera = () => {
    if (state.localStream) {
        const isCurrentlyOff = state.isCameraOff;
        state.localStream.getVideoTracks().forEach(track => track.enabled = isCurrentlyOff);
        setState(s => ({ ...s, isCameraOff: !isCurrentlyOff }));
    }
};

// --- SOCKET LISTENERS ---

const setupSocketListeners = () => {
    if (!socketInstance) return;

    const handleIncomingCall = async (data: { from: User, offer: RTCSessionDescriptionInit }) => {
        // We already get the full user object from the server now
        setState(s => ({ ...s, incomingCall: { caller: data.from, offer: data.offer }, peer: data.from, callStatus: 'incoming' }));
    };

    const handleAnswer = (data: { answer: RTCSessionDescriptionInit }) => {
        if (pcRef && pcRef.signalingState !== 'stable') {
            pcRef.setRemoteDescription(new RTCSessionDescription(data.answer));
            setState(s => ({ ...s, callStatus: 'in-call' }));
        }
    };

    const handleIceCandidate = (data: { candidate: RTCIceCandidateInit }) => {
        if (pcRef && data.candidate) {
            pcRef.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
        }
    };

    socketInstance.on('call:incoming', handleIncomingCall);
    socketInstance.on('webrtc:answer', handleAnswer);
    socketInstance.on('webrtc:ice-candidate', handleIceCandidate);
    socketInstance.on('call:rejected', endCallCleanup);
    socketInstance.on('call:end', endCallCleanup);
};
