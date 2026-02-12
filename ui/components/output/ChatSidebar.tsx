import React from 'react'
import { motion } from 'framer-motion'
import { ThumbsUp, ThumbsDown, Copy } from 'lucide-react'
import { Logo } from '../Logo'
import { ThoughtProcess } from './ThoughtProcess'
import { ChatPromptInput } from '../prompt/ChatPromptInput'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface ChatSidebarProps {
  onBack: () => void
  isGenerating: boolean
  steps: string[]
  executionTime: number
  isThoughtsOpen: boolean
  setIsThoughtsOpen: (val: boolean) => void
  editPrompt: string
  setEditPrompt: (val: string) => void
  handleApplyEdit: () => void
  isVisualMode: boolean
  setIsVisualMode: (val: boolean) => void
  selectedElement: { tagName: string; textContent: string } | null
  handleClearSelection: () => void
  isApplyingEdit: boolean
  isCollapsed: boolean
}

const ChatAction = ({
  icon: Icon,
  onClick,
  title,
}: {
  icon: any
  onClick?: () => void
  title: string
}) => (
  <Button
    variant="ghost"
    size="icon-sm"
    onClick={onClick}
    className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-md"
    title={title}
  >
    <Icon size={13} />
  </Button>
)

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  onBack,
  isGenerating,
  steps,
  executionTime,
  isThoughtsOpen,
  setIsThoughtsOpen,
  editPrompt,
  setEditPrompt,
  handleApplyEdit,
  isVisualMode,
  setIsVisualMode,
  selectedElement,
  handleClearSelection,
  isApplyingEdit,
  isCollapsed,
}) => {
  return (
    <aside
      className={cn(
        'h-full bg-[#050505] flex flex-col overflow-hidden shrink-0 z-20 transition-all duration-300 ease-in-out border-white/10',
        isCollapsed ? 'w-0 border-r-0' : 'w-[340px] border-r'
      )}
    >
      {/* Header */}
      <div className="h-14 flex items-center shrink-0 border-b border-white/5 px-6 min-w-[340px]">
        <button
          onClick={onBack}
          className="hover:opacity-80 transition-opacity focus:outline-none"
          title="Back to Home"
        >
          <Logo className="scale-90 origin-left" />
        </button>
      </div>

      {/* Chat Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-[340px]">
        <div className="flex-1 overflow-y-auto p-5 scrollbar-hide pb-0">
          <div className="flex flex-col gap-8">
            {/* User Message */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group flex flex-col items-end gap-1"
            >
              <div className="bg-[#1C1C1C] text-neutral-100 text-[15px] px-5 py-3.5 rounded-2xl rounded-tr-sm max-w-[90%] leading-relaxed border border-white/5 shadow-sm group-hover:border-white/10 transition-colors selection:bg-white/20">
                Create a modern landing page for a SaaS company called "Acme
                Corp"
              </div>
            </motion.div>

            {/* AI Response Section */}
            <div className="flex flex-col gap-2 animate-in fade-in duration-500">
              <ThoughtProcess
                isGenerating={isGenerating}
                steps={steps}
                executionTime={executionTime}
                isOpen={isThoughtsOpen}
                setIsOpen={setIsThoughtsOpen}
              />

              {/* Final LLM Message */}
              {!isGenerating && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="pl-1 space-y-4"
                >
                  <div className="text-[15px] text-neutral-300 leading-7 font-light selection:bg-blue-500/20">
                    I've crafted a high-fidelity landing page for{' '}
                    <span className="text-white font-medium">Acme Corp</span>.
                    It features a dark-themed aesthetic, dynamic metrics grid,
                    and a responsive navbar.
                  </div>

                  {/* Chat Actions */}
                  <div className="flex gap-2 pt-2">
                    <ChatAction icon={ThumbsUp} title="Helpful" />
                    <ChatAction icon={ThumbsDown} title="Not Helpful" />
                    <ChatAction icon={Copy} title="Copy" />
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Input Area */}
        <ChatPromptInput
          value={editPrompt}
          onChange={setEditPrompt}
          onSubmit={handleApplyEdit}
          isVisualMode={isVisualMode}
          onToggleVisualMode={() => setIsVisualMode(!isVisualMode)}
          selectedElement={selectedElement}
          onClearSelection={handleClearSelection}
          isApplyingEdit={isApplyingEdit}
        />
      </div>
    </aside>
  )
}
