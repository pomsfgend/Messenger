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
    cameraFacingMode: 'user' | 'environment';
    connectionQuality: number;
    peerConnectionQuality: number | null;
}

const initialState: CallState = {
    callStatus: 'idle',
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isCameraOff: false,
    peer: null,
    incomingCall: null,
    cameraFacingMode: 'user',
    connectionQuality: 100,
    peerConnectionQuality: null,
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
     // Re-assign streams if they already exist when refs are set
    if (localVideoRef?.current && state.localStream) {
        localVideoRef.current.srcObject = state.localStream;
    }
    if (remoteVideoRef?.current && state.remoteStream) {
        remoteVideoRef.current.srcObject = state.remoteStream;
    }
};

// --- ACTIONS ---

const endCallCleanup = () => {
    if (pcRef) {
        pcRef.onicecandidate = null;
        pcRef.ontrack = null;
        pcRef.oniceconnectionstatechange = null;
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

        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        setState(s => ({ ...s, localStream: stream }));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const currentUser = await api.checkSession();
        socketInstance.emit('call:start', { to: peerToCall.id, from: currentUser, offer });

    } catch (err) {
        console.error("Failed to start call:", err);
        toast.error("Could not start call. Check camera/mic permissions.");
        setState(s => ({ ...s, callStatus: "failed" }));
        endCallCleanup();
    }
};

export const acceptCall = async () => {
    const { incomingCall } = state;
    if (!socketInstance || !incomingCall) return;
    
    // Cache the call data before updating the state
    const { offer, caller } = incomingCall;
    
    setState(s => ({ ...s, callStatus: 'in-call', incomingCall: null, peer: caller }));
    try {
        const pc = await setupPeerConnection(caller.id);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        setState(s => ({ ...s, localStream: stream }));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketInstance.emit('webrtc:answer', { to: caller.id, answer });

    } catch (err) {
        console.error("Failed to answer call:", err);
        toast.error("Could not answer call. Check camera/mic permissions.");
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

export const switchCamera = async (facingMode: 'user' | 'environment') => {
    if (!state.localStream || !pcRef) return;
    
    try {
        // Stop current video tracks to release the camera
        state.localStream.getVideoTracks().forEach(track => track.stop());
        
        // Get new stream with the other camera, keeping audio settings
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
            audio: true
        });
        
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (!newVideoTrack) throw new Error("No new video track found");
        
        // Replace the track in the PeerConnection
        const sender = pcRef.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
            await sender.replaceTrack(newVideoTrack);
        } else {
            pcRef.addTrack(newVideoTrack, newStream);
        }

        // Combine new video with existing audio to form the new local stream
        const finalStream = new MediaStream([newVideoTrack, ...state.localStream.getAudioTracks()]);

        setState(s => ({ ...s, localStream: finalStream, cameraFacingMode: facingMode }));
        
    } catch (err) {
        console.error('Error switching camera:', err);
        toast.error('Could not switch camera.');
        // Re-enable old stream tracks if switching fails
        state.localStream.getTracks().forEach(t => t.enabled = true);
    }
};

// --- SOCKET LISTENERS ---

const setupSocketListeners = () => {
    if (!socketInstance) return;

    const handleIncomingCall = (data: { from: User, offer: RTCSessionDescriptionInit }) => {
        // Only accept a new call if not already in one
        if (state.callStatus === 'idle') {
            setState(s => ({ ...s, incomingCall: { caller: data.from, offer: data.offer }, peer: data.from, callStatus: 'incoming' }));
        }
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
    
    const handleQualityUpdate = (data: { quality: number }) => {
        setState(s => ({ ...s, peerConnectionQuality: data.quality }));
    };

    socketInstance.on('call:incoming', handleIncomingCall);
    socketInstance.on('webrtc:answer', handleAnswer);
    socketInstance.on('webrtc:ice-candidate', handleIceCandidate);
    socketInstance.on('call:rejected', endCallCleanup);
    socketInstance.on('call:end', endCallCleanup);
    socketInstance.on('call:quality-update', handleQualityUpdate);
};


// --- Connection Quality Polling ---
setInterval(async () => {
    if (state.callStatus !== 'in-call' || !pcRef || !socketInstance || !state.peer) {
        return;
    }

    try {
        const stats = await pcRef.getStats();
        let packetsLost = 0;
        let jitter = 0;
        let roundTripTime = 0;
        let score = 100;

        stats.forEach(report => {
            if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
                packetsLost = report.packetsLost ?? packetsLost;
                jitter = report.jitter ?? jitter;
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                roundTripTime = report.currentRoundTripTime ?? roundTripTime;
            }
        });
        
        // Scoring logic (can be fine-tuned)
        score -= packetsLost * 1; // Each lost packet reduces score
        score -= jitter * 500;   // Jitter (in seconds) has a large impact
        score -= roundTripTime * 100; // Round trip time (in seconds) also impacts
        
        const finalScore = Math.max(0, Math.min(100, Math.round(score)));
        
        if (finalScore !== state.connectionQuality) {
            setState(s => ({ ...s, connectionQuality: finalScore }));
            socketInstance.emit('call:quality-update', { to: state.peer!.id, quality: finalScore });
        }

    } catch (error) {
        console.warn("Could not get WebRTC stats:", error);
    }

}, 3000);
