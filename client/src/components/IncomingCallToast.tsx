import React from 'react';
import toast from 'react-hot-toast';
import { User } from '../types';
import Avatar from './Avatar';
import { FaPhone, FaPhoneSlash } from 'react-icons/fa';

interface IncomingCallToastProps {
    caller: User;
    onAccept: () => void;
    onReject: () => void;
}

const IncomingCallToast = ({ caller, onAccept, onReject }: IncomingCallToastProps) => {
    if (navigator.vibrate) {
        // Vibrate pattern: 200ms vibration, 100ms pause, 200ms vibration
        navigator.vibrate([200, 100, 200]);
    }

    return toast.custom(
        (t) => (
            <div
                className={`${
                    t.visible ? 'animate-fade-in-up' : 'animate-pulse'
                } max-w-md w-full bg-slate-800 shadow-lg rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4`}
            >
                <div className="flex-1 w-0">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <Avatar user={caller} />
                        </div>
                        <div className="ml-4 flex-1">
                            <p className="text-sm font-medium text-white">
                                Incoming Call
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                                {caller.name} is calling...
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 ml-4 pl-4 border-l border-slate-700">
                     <button
                        onClick={() => {
                            onReject();
                            toast.dismiss(t.id);
                        }}
                        className="w-14 h-14 flex items-center justify-center rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                        aria-label="Reject call"
                    >
                        <FaPhoneSlash size={20} />
                    </button>
                    <button
                        onClick={() => {
                            onAccept();
                            toast.dismiss(t.id);
                        }}
                        className="w-14 h-14 flex items-center justify-center rounded-full bg-green-500/80 hover:bg-green-500 text-white transition-colors"
                        aria-label="Accept call"
                    >
                        <FaPhone size={20} />
                    </button>
                </div>
            </div>
        ),
        {
            id: `incoming-call-${caller.id}`,
            duration: 30000, // 30 seconds for user to respond
        }
    );
};

export default IncomingCallToast;