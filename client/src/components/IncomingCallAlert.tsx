import React, { useEffect, useRef } from 'react';
import { User } from '../types';
import Avatar from './Avatar';

interface IncomingCallAlertProps {
    caller: User;
    onAccept: () => void;
    onReject: () => void;
}

const IncomingCallAlert: React.FC<IncomingCallAlertProps> = ({ caller, onAccept, onReject }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        audioRef.current?.play().catch(e => console.error("Ringtone play failed", e));
        return () => {
            audioRef.current?.pause();
        };
    }, []);
    
    return (
        <div className="fixed top-5 right-5 z-[200] w-full max-w-sm p-4 rounded-2xl shadow-2xl bg-slate-800/80 backdrop-blur-lg border border-slate-600 animate-fade-in-up">
            <audio ref={audioRef} src="/assets/incoming_call.mp3" loop />
            <div className="flex items-center">
                <div className="relative">
                    <Avatar user={caller} size="default" />
                    <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-ring"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-green-400 animate-ring" style={{animationDelay: '0.75s'}}></div>
                </div>
                <div className="ml-4 flex-1">
                    <p className="font-bold text-white">{caller.name}</p>
                    <p className="text-sm text-slate-300">Входящий анонимный вызов...</p>
                </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
                <button 
                    onClick={onReject}
                    className="w-12 h-12 flex items-center justify-center bg-red-600 text-white rounded-full hover:bg-red-700 transition-transform transform hover:scale-110"
                    aria-label="Reject call"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l6-6-6 6-6-6-6 6 6 6-6 6 6 6 6-6 6 6-6-6z" /></svg>
                </button>
                <button 
                    onClick={onAccept}
                    className="w-12 h-12 flex items-center justify-center bg-green-500 text-white rounded-full hover:bg-green-600 transition-transform transform hover:scale-110"
                    aria-label="Accept call"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                </button>
            </div>
        </div>
    );
};

export default IncomingCallAlert;
