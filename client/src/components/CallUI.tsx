import React, { useRef, useState, useEffect } from 'react';
import { useCall } from '../hooks/useCall';
import { useDraggable } from '../hooks/useDraggable';
import { useResizable } from '../hooks/useResizable';
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash } from 'react-icons/fa';
import Avatar from './Avatar';

const CallUI: React.FC = () => {
    const { 
        callState, 
        localStream, 
        remoteStream, 
        endCall,
        callee,
        isLocalAudioMuted,
        isLocalVideoMuted,
        toggleLocalAudio,
        toggleLocalVideo,
    } = useCall();
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    const modalId = 'call-ui';
    const { transform } = useDraggable(modalRef, handleRef, modalId);
    const { size } = useResizable(modalRef, modalId);

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
    
    const renderCallStatus = () => {
        if(callState === 'outgoing') return `Вызов ${callee?.name || '...'} ...`;
        if(callState === 'connected' && !remoteStream) return 'Подключение...';
        if(callState === 'connected' && remoteStream) return `В разговоре с ${callee?.name || ''}`;
        return 'Завершение...';
    }

    return (
        <div className="fixed inset-0 z-[190] pointer-events-none flex items-center justify-center">
            <div
                ref={modalRef}
                className="soft-panel bg-slate-900/80 shadow-2xl rounded-2xl flex flex-col overflow-hidden pointer-events-auto"
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px)`,
                    width: size.width ? `${size.width}px` : 'min(90vw, 800px)',
                    height: size.height ? `${size.height}px` : 'min(90vh, 600px)',
                    minWidth: '320px',
                    minHeight: '400px'
                }}
            >
                <div ref={handleRef} className="absolute top-0 left-0 right-0 p-3 text-center text-white bg-black/20 cursor-move z-20">
                    <p className="font-semibold">{renderCallStatus()}</p>
                </div>

                <div className="relative flex-1 bg-black">
                    {/* Remote Video */}
                    <video ref={remoteVideoRef} autoPlay playsInline className="call-video w-full h-full object-cover" />
                    {!remoteStream && (
                         <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                            <Avatar user={callee || {}} size="large" />
                         </div>
                    )}
                    
                    {/* Local Video */}
                    <div className="absolute bottom-4 right-4 w-1/4 max-w-[150px] aspect-[3/4] rounded-lg overflow-hidden shadow-lg border-2 border-slate-500/50">
                        {localStream && !isLocalVideoMuted ? (
                             <video ref={localVideoRef} autoPlay playsInline muted className="call-video w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                <FaVideoSlash className="text-slate-500 text-3xl" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-black/20 p-4 flex justify-center items-center gap-6 z-10">
                    <button onClick={toggleLocalAudio} className={`p-4 rounded-full transition-colors ${isLocalAudioMuted ? 'bg-white/20 text-white' : 'bg-white/10 text-white'}`}>
                        {isLocalAudioMuted ? <FaMicrophoneSlash size={20} /> : <FaMicrophone size={20} />}
                    </button>
                    <button onClick={toggleLocalVideo} className={`p-4 rounded-full transition-colors ${isLocalVideoMuted ? 'bg-white/20 text-white' : 'bg-white/10 text-white'}`}>
                         {isLocalVideoMuted ? <FaVideoSlash size={20} /> : <FaVideo size={20} />}
                    </button>
                    <button onClick={endCall} className="p-4 rounded-full bg-red-600 text-white transform hover:scale-110 transition-transform">
                        <FaPhoneSlash size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CallUI;
