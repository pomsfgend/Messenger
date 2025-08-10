import React, { useEffect, useState, useRef } from 'react';
import { useCallState, acceptCall, rejectCall, endCall, toggleMute, toggleCamera, switchCamera, setVideoRefs } from '../../hooks/useCall';
import { User } from '../../types';
import { 
    PhoneIcon, PhoneMissedIcon, PhoneOffIcon, 
    MicIcon, MicOffIcon, VideoIcon, VideoOffIcon,
    CameraSwitchIcon, MinimizeIcon, MaximizeIcon,
    ConnectionIcon
} from './CallIcons';

export const CallInterface: React.FC = () => {
    const {
        callStatus,
        localStream,
        remoteStream,
        isMuted,
        isCameraOff,
        incomingCall,
        peer,
        cameraFacingMode
    } = useCallState();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const [peerInfo, setPeerInfo] = useState<User | null>(null);
    const [callTime, setCallTime] = useState(0);
    const [callTimer, setCallTimer] = useState<number | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [connectionQuality, setConnectionQuality] = useState<number>(100); // 0-100%
    const qualityTimerRef = useRef<number | null>(null);
    
    useEffect(() => {
        setVideoRefs({ local: localVideoRef, remote: remoteVideoRef });
    }, []);
    
    useEffect(() => {
        if(localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);
    
    useEffect(() => {
        if(remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // Call timer
    useEffect(() => {
        if (callStatus === 'in-call' && !callTimer) {
            const timer = window.setInterval(() => {
                setCallTime(prev => prev + 1);
            }, 1000);
            setCallTimer(timer);
        } else if (callStatus !== 'in-call' && callTimer) {
            clearInterval(callTimer);
            setCallTimer(null);
            setCallTime(0);
        }

        return () => {
            if (callTimer) clearInterval(callTimer);
        };
    }, [callStatus, callTimer]);

    // Simulate connection quality
    useEffect(() => {
        if (callStatus === 'in-call') {
            qualityTimerRef.current = window.setInterval(() => {
                // In a real app, this would use the WebRTC statistics API
                const simulatedQuality = Math.max(30, Math.floor(Math.random() * 100));
                setConnectionQuality(simulatedQuality);
            }, 3000);
        }

        return () => {
            if (qualityTimerRef.current) {
                clearInterval(qualityTimerRef.current);
            }
        };
    }, [callStatus]);

    // Update peer info
    useEffect(() => {
        if (peer) {
            setPeerInfo(peer);
        } else if (incomingCall) {
            setPeerInfo(incomingCall.caller);
        }
    }, [peer, incomingCall]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getQualityColor = (quality: number) => {
        if (quality > 70) return 'bg-green-500';
        if (quality > 40) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const toggleMinimize = () => {
        setIsMinimized(!isMinimized);
    };
    
    const handleSwitchCamera = () => {
        const newMode = cameraFacingMode === 'user' ? 'environment' : 'user';
        switchCamera(newMode);
    };

    if (callStatus === 'idle' || callStatus === 'failed') {
        return null;
    }

    if (isMinimized) {
        return (
            <div className="fixed bottom-28 right-5 w-32 md:w-40 aspect-[3/4] rounded-lg overflow-hidden shadow-2xl bg-black z-[2000] animate-fade-in-up">
                <video 
                    ref={localVideoRef}
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                />
                <button 
                    onClick={toggleMinimize}
                    className="absolute top-1 right-1 bg-white/30 rounded-full p-1.5 backdrop-blur-sm"
                >
                    <MaximizeIcon />
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[2000] bg-gray-900 flex flex-col overflow-hidden">
            {/* Main Video Area */}
            <div className="flex-grow relative">
                <video 
                    ref={remoteVideoRef}
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-contain bg-black"
                />
                
                {/* Self-view Picture-in-Picture */}
                <div className="absolute bottom-[120px] sm:bottom-4 right-4 w-32 h-48 md:w-40 md:h-60 rounded-lg overflow-hidden shadow-lg border-2 border-white/20">
                    <video 
                        ref={localVideoRef}
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover"
                    />
                </div>
                
                {/* Call Info Overlay */}
                <div className="absolute top-4 left-4 right-4 flex justify-center pointer-events-none">
                    {peerInfo && (
                        <div className="bg-black/50 rounded-full py-2 px-5 text-white text-center backdrop-blur-sm">
                            <div className="text-xl font-bold">
                                {peerInfo.name || peerInfo.username || 'Unknown'}
                            </div>
                            <div className="text-sm text-gray-300">
                                {callStatus === 'in-call' ? formatTime(callTime) : (callStatus === 'incoming' ? 'Incoming Call' : 'Calling...')}
                            </div>
                        </div>
                    )}
                </div>

                {/* Connection Quality Indicator */}
                {callStatus === 'in-call' && (
                    <div className="absolute top-4 right-4 flex items-center bg-black/50 rounded-full px-3 py-1.5 backdrop-blur-sm">
                        <ConnectionIcon />
                        <div className="ml-2 flex items-center">
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                <div 
                                    className={`h-1.5 rounded-full ${getQualityColor(connectionQuality)}`}
                                    style={{ width: `${connectionQuality}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Minimize Button */}
                <button 
                    onClick={toggleMinimize}
                    className="absolute top-4 left-4 bg-black/50 rounded-full p-2.5 backdrop-blur-sm pointer-events-auto"
                >
                    <MinimizeIcon />
                </button>
            </div>

            {/* Controls Panel */}
            <div className="bg-black/50 py-4 flex justify-center space-x-4 sm:space-x-8 flex-shrink-0">
                {callStatus === 'incoming' ? (
                    <>
                        <button onClick={rejectCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center transition-transform hover:scale-110">
                            <PhoneMissedIcon />
                        </button>
                        <button onClick={acceptCall} className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center transition-transform hover:scale-110">
                            <PhoneIcon />
                        </button>
                    </>
                ) : (
                    <>
                        <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${ isMuted ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600' }`}>
                            {isMuted ? <MicOffIcon /> : <MicIcon />}
                        </button>
                        
                        <button onClick={toggleCamera} className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${ isCameraOff ? 'bg-red-500' : 'bg-gray-700 hover:bg-gray-600' }`}>
                            {isCameraOff ? <VideoOffIcon /> : <VideoIcon />}
                        </button>
                        
                        <button onClick={handleSwitchCamera} className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center">
                            <CameraSwitchIcon />
                        </button>
                        
                        <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center transition-transform hover:scale-110">
                            <PhoneOffIcon />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};