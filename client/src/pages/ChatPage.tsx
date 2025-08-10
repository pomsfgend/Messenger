import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import ChatPlaceholder from '../components/ChatPlaceholder';

const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // When the user navigates, close the sidebar on mobile.
    setIsSidebarOpen(false);
  }, [location]);


  return (
    <div className="h-[var(--app-height)] w-full flex antialiased overflow-hidden relative">
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}
      
       {/* Sidebar */}
      <div className={`
        w-80 flex-shrink-0
        absolute lg:static top-0 left-0 h-full z-50
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
         <Sidebar 
            activeChatId={chatId}
            onSidebarClose={() => setIsSidebarOpen(false)} 
        />
      </div>

      <div className="flex-1 flex flex-col h-full relative bg-slate-200 dark:bg-slate-800">
        {chatId ? (
            <ChatWindow 
                key={chatId} 
                chatId={chatId}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />
        ) : (
            <ChatPlaceholder onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        )}
      </div>
    </div>
  );
};

export default ChatPage;