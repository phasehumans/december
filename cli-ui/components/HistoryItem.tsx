import React from 'react';
import { Message, Role } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { CheckIcon } from './TerminalIcon';

interface HistoryItemProps {
  message: Message;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  if (isUser) {
    return (
      <div className="mb-4 mt-6">
        <div className="flex items-start gap-3 font-mono text-base">
          <span className="text-blue-500 font-bold mt-1">›</span>
          <span className="text-zinc-100 whitespace-pre-wrap mt-1">{message.content}</span>
        </div>
      </div>
    );
  }

  // Assistant Message
  return (
    <div className="mb-8 pl-5 border-l-2 border-zinc-800/50">
      <div className="pl-2">
        <MarkdownRenderer content={message.content} />
      </div>
      {!message.isStreaming && (
         <div className="mt-4 pl-2 flex items-center gap-2 text-[10px] text-zinc-600 uppercase tracking-widest font-bold opacity-50">
            <span>End of output</span>
         </div>
      )}
    </div>
  );
};

export default HistoryItem;