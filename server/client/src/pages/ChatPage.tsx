
import React from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import { useI18n } from '../hooks/useI18n';

const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { t } = useI18n();

  return (
    <div className="h-screen w-screen flex bg-slate-800 antialiased text-slate-300 overflow-hidden">
      <Sidebar activeChatId={chatId} />
      <div className="flex-1 flex flex-col h-full">
        {chatId ? (
          <ChatWindow key={chatId} chatId={chatId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            {t('chat.selectPrompt')}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;