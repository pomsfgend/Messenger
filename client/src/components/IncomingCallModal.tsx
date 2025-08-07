import React, { useRef } from 'react';
import type { User } from '../types';
import Avatar from './Avatar';
import { useDraggable } from '../hooks/useDraggable';

interface IncomingCallModalProps {
    caller: User;
    onAccept: () => void;
    onReject: () => void;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({ caller, onAccept, onReject }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const { transform } = useDraggable(modalRef, modalRef, 'incoming-call');

    return (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
            <div
                ref={modalRef}
                className="soft-panel bg-slate-800/90 text-white w-full max-w-sm p-8 flex flex-col items-center gap-6 animate-fade-in-up cursor-move"
                style={{ transform: `translate(${transform.x}px, ${transform.y}px)` }}
            >
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <Avatar user={caller} size="large" />
                        <div className="absolute inset-0 rounded-full ring-4 ring-indigo-500 ring-offset-4 ring-offset-slate-800 animate-pulse"></div>
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold">{caller.name}</h2>
                        <p className="text-slate-300">Входящий вызов...</p>
                    </div>
                </div>

                <div className="flex justify-center gap-6 w-full mt-4">
                    <button
                        onClick={onReject}
                        className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white transition-transform hover:scale-110"
                        aria-label="Reject call"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l6-6-6 6zM8 8l-6-6 6 6zM12 12l6 6-6-6zM12 12l-6 6 6-6z" transform="rotate(45 12 12)" /></svg>
                    </button>
                    <button
                        onClick={onAccept}
                        className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white transition-transform hover:scale-110"
                        aria-label="Accept call"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 3a1 1 0 011-1h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 010 1.414l-1 1a1 1 0 01-1.414 0l-1.293-1.293a1 1 0 00-1.414 0l-1 1a1 1 0 01-1.414 0l-2.414-2.414A1 1 0 012 3.414V3z" />
                            <path d="M15 1a1 1 0 011 1v1.586a1 1 0 01-.293.707l-2.414 2.414a1 1 0 01-1.414 0l-1-1a1 1 0 010-1.414l1.293-1.293a1 1 0 000-1.414l-1-1a1 1 0 010-1.414l2.414-2.414A1 1 0 0114.586 1H16a1 1 0 01-1 1z" transform="rotate(90 10 10)" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IncomingCallModal;
