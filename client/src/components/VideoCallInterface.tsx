import React, { useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import { useWebRTC } from '../hooks/useWebRTC';
import Avatar from './Avatar';
import './VideoCallInterface.css';

interface VideoCallInterfaceProps {
    partner: User;
    onEndCall: () => void;
    isCaller?: boolean;
}

const VideoCallInterface: React.FC<VideoCallInterfaceProps> = ({ partner, onEndCall, isCaller }) => {
    const [connectionState, setConnectionState] = useState<RTCIceConnectionState>('new');
    const { localStream, remoteStream, startCall, answerCall, closeConnection, toggleAudio, toggleVideo } = useWebRTC(partner, setConnectionState);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);

    useEffect(() => {
        if (isCaller) {
            startCall();
        } else {
            answerCall();
        }
        return () => closeConnection();
    }, [isCaller, startCall, answerCall, closeConnection]);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);
    
    const handleToggleAudio = () => {
        setIsAudioMuted(prev => {
            toggleAudio(!prev);
            return !prev;
        });
    };

    const handleToggleVideo = () => {
        setIsVideoEnabled(prev => {
            toggleVideo(!prev);
            return !prev;
        });
    };

    const statusMap: Record<RTCIceConnectionState, string> = {
        new: 'Подключение...',
        checking: 'Проверка соединения...',
        connected: 'Соединено',
        completed: 'Соединение установлено',
        disconnected: 'Отключено',
        failed: 'Ошибка соединения',
        closed: 'Звонок завершен',
    };

    return (
        <div className="video-call-container">
            <div className="status-bar">{statusMap[connectionState] || connectionState}</div>
            
            <div className="video-grid">
                <div className="remote-video-wrapper">
                    {remoteStream ? (
                        <video ref={remoteVideoRef} autoPlay playsInline className="video-element" />
                    ) : (
                        <div className="w-48 h-48 flex flex-col items-center justify-center gap-4">
                            <Avatar user={partner} size="large" />
                            <p className="font-bold text-xl text-white">{partner.name}</p>
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-500"></div>
                        </div>
                    )}
                </div>
                <div className="local-video-wrapper">
                    {localStream && (
                        <video ref={localVideoRef} autoPlay playsInline muted className="video-element" />
                    )}
                </div>
            </div>

            <div className="controls-bar">
                <button onClick={handleToggleAudio} className={`control-btn ${!isAudioMuted ? 'active' : 'inactive'}`}>
                    {isAudioMuted ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>}
                </button>
                <button onClick={handleToggleVideo} className={`control-btn ${isVideoEnabled ? 'active' : 'inactive'}`}>
                     {isVideoEnabled ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>}
                </button>
                <button onClick={onEndCall} className="control-btn end-call">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l6-6-6 6zM8 8l-6-6 6 6zM12 12l6 6-6-6zM12 12l-6 6 6-6z" transform="rotate(45 12 12)" /></svg>
                </button>
            </div>
        </div>
    );
};

export default VideoCallInterface;
