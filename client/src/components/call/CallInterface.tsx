import React, { useEffect, useState, useRef } from 'react';
import { useCallState, acceptCall, rejectCall, endCall, toggleMute, toggleCamera, switchCamera, setVideoRefs } from '../../hooks/useCall';
import { User } from '../../types';
import Avatar from '../Avatar';
import { 
    PhoneIcon, PhoneOffIcon, MicIcon, MicOffIcon, VideoIcon, VideoOffIcon,
    CameraSwitchIcon, MinimizeIcon, MaximizeIcon, ConnectionIcon
} from './CallIcons';
import { useDraggable } from '../../hooks/useDraggable';

export const CallInterface: React.FC = () => {
    const {
        callStatus,
        localStream,
        remoteStream,
        isMuted,
        isCameraOff,
        incomingCall,
        peer,
        cameraFacingMode,
        connectionQuality,
        peerConnectionQuality
    } = useCallState();

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const ringtoneRef = useRef<HTMLAudioElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const { transform } = useDraggable(wrapperRef, wrapperRef, 'call-window');
    
    const [peerInfo, setPeerInfo] = useState<User | null>(null);
    const [callTime, setCallTime] = useState(0);
    const [callTimer, setCallTimer] = useState<number | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    
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

    // Ringtone effect
    useEffect(() => {
        if (callStatus === 'incoming' && ringtoneRef.current) {
            ringtoneRef.current.play().catch(e => console.error("Ringtone play failed:", e));
        } else if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }
    }, [callStatus]);

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

    const getQualityColor = (quality: number | null) => {
        if (quality === null) return 'bg-gray-500';
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

    // Always render the ringtone audio element
    const renderRingtone = () => (
        <audio ref={ringtoneRef} src="/assets/notification.mp3" loop preload="auto" />
    );

    if (callStatus === 'incoming' && peerInfo) {
        return (
             <div className="fixed inset-0 z-[2000] bg-gray-900/90 backdrop-blur-lg flex flex-col justify-between items-center p-8 animate-fade-in">
                {renderRingtone()}
                <div className="text-center text-white mt-16">
                     <Avatar user={peerInfo} size="large" />
                     <p className="text-2xl font-bold mt-4">{peerInfo.name}</p>
                     <p className="text-lg text-gray-300">Входящий звонок...</p>
                </div>
                <div className="flex items-center gap-12">
                     <button onClick={rejectCall} className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center transition-transform hover:scale-110">
                        <PhoneOffIcon />
                    </button>
                     <button onClick={acceptCall} className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center transition-transform hover:scale-110">
                        <PhoneIcon />
                    </button>
                </div>
            </div>
        )
    }

    const wrapperClasses = [
        'fixed z-[2000] bg-gray-900 flex flex-col overflow-hidden transition-all duration-300 ease-in-out call-window-wrapper',
        isMinimized ? 'minimized' : 'inset-0'
    ].join(' ');

    return (
        <div 
            ref={wrapperRef}
            style={isMinimized ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}}
            className={wrapperClasses}
        >
            {renderRingtone()}
            {/* Main Video Area */}
            <div className="flex-grow relative min-h-0 w-full h-full">
                <video 
                    ref={remoteVideoRef}
                    autoPlay 
                    playsInline 
                    className={`w-full h-full bg-black ${isMinimized ? 'object-cover pointer-events-none' : 'object-contain'}`}
                />
                
                {/* Self-view Picture-in-Picture - hidden when minimized */}
                <div className={`absolute bottom-[120px] sm:bottom-4 right-4 w-32 h-48 md:w-40 md:h-60 rounded-lg overflow-hidden shadow-lg border-2 border-white/20 transition-opacity ${isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <video 
                        ref={localVideoRef}
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover"
                    />
                </div>
                
                {/* Call Info Overlay - hidden when minimized */}
                <div className={`absolute top-4 left-4 right-4 flex justify-center pointer-events-none transition-opacity ${isMinimized ? 'opacity-0' : 'opacity-100'}`}>
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

                {/* Connection Quality Indicator - hidden when minimized */}
                {callStatus === 'in-call' && (
                    <div className={`absolute top-4 right-4 flex flex-col items-end gap-1.5 bg-black/50 rounded-lg px-3 py-1.5 backdrop-blur-sm text-white text-xs transition-opacity ${isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        <div className="flex items-center gap-2" title="Your Connection">
                            <span className="font-bold">You</span>
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${getQualityColor(connectionQuality)} transition-all duration-300`} style={{ width: `${connectionQuality}%` }}></div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2" title={`${peerInfo?.name}'s Connection`}>
                            <span className="font-bold">Peer</span>
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${getQualityColor(peerConnectionQuality)} transition-all duration-300`} style={{ width: `${peerConnectionQuality ?? 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                )}


                {/* Minimize/Maximize Buttons */}
                <button 
                    onClick={toggleMinimize}
                    className={`absolute top-4 left-4 bg-black/50 rounded-full p-2.5 backdrop-blur-sm pointer-events-auto transition-opacity ${isMinimized ? 'opacity-0' : 'opacity-100'}`}
                >
                    <MinimizeIcon />
                </button>
                 <button 
                    onClick={toggleMinimize}
                    className={`absolute top-1 right-1 bg-white/30 rounded-full p-1.5 backdrop-blur-sm transition-opacity ${isMinimized ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    <MaximizeIcon />
                </button>
            </div>

            {/* Controls Panel - hidden when minimized */}
            <div className={`bg-black/50 py-4 flex justify-center space-x-4 sm:space-x-8 flex-shrink-0 transition-opacity ${isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                {(callStatus === 'in-call' || callStatus === 'calling') && (
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