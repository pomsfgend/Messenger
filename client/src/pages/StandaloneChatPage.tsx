import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import ChatWindow from '../components/ChatWindow';
import ParticleBackground from '../components/ParticleBackground';

const StandaloneChatPage: React.FC = () => {
    const { chatId } = ReactRouterDOM.useParams<{ chatId: string }>();

    if (!chatId) {
        // This case should ideally not happen if routing is correct.
        // Redirecting to the main app is a safe fallback.
        return <ReactRouterDOM.Navigate to="/app" replace />;
    }

    return (
        <div className="h-screen w-screen flex flex-col antialiased text-slate-800 dark:text-slate-100 relative">
            <ParticleBackground />
            <div className="relative z-10 w-full h-full">
                <ChatWindow
                    chatId={chatId}
                    isStandalone={true}
                    onToggleSidebar={() => {}} // This is a no-op as there is no sidebar
                />
            </div>
        </div>
    );
};

export default StandaloneChatPage;