import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  X,
  Pin,
  Trash2,
  Calendar,
  ArrowUpRight,
  LayoutTemplate,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

const historyItems = [
  {
    id: 1,
    title: 'Phase Humans Final',
    description:
      'A prompt-to-website generator with a high-fidelity dark mode UI.',
    time: '8m ago',
    type: 'SaaS',
    pinned: true,
  },
  {
    id: 2,
    title: 'E-commerce Dashboard',
    description: 'Modern dark mode dashboard for shopify store analytics.',
    time: '53m ago',
    type: 'Dashboard',
    pinned: false,
  },
  {
    id: 3,
    title: 'SaaS Landing Page',
    description: 'High conversion landing page for AI tool with pricing grids.',
    time: '1h ago',
    type: 'Landing',
    pinned: false,
  },
  {
    id: 4,
    title: 'Portfolio v2',
    description: 'Minimalist portfolio for photographer focusing on imagery.',
    time: '2h ago',
    type: 'Portfolio',
    pinned: false,
  },
  {
    id: 5,
    title: 'Crypto Exchange',
    description: 'Real-time trading interface with candlestick charts.',
    time: '1d ago',
    type: 'App',
    pinned: false,
  },
  {
    id: 6,
    title: 'Marketing Analytics',
    description: 'Data visualization tool for marketing campaigns.',
    time: '2d ago',
    type: 'Dashboard',
    pinned: false,
  },
]

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [search, setSearch] = useState('')

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const filteredItems = historyItems.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{
              type: 'spring',
              duration: 0.5,
              bounce: 0.2,
            }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-2xl bg-[#09090B] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto flex flex-col max-h-[650px] overflow-hidden ring-1 ring-white/5">
              {/* Search Header */}
              <div className="flex flex-col gap-4 p-5 border-b border-white/5 bg-[#09090B]">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-white tracking-tight flex items-center gap-2">
                    <LayoutTemplate size={18} className="text-neutral-500" />
                    Project History
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-neutral-500 bg-white/5 px-2 py-1 rounded">
                      ESC to close
                    </span>
                  </div>
                </div>
                <div className="relative group">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-white transition-colors"
                    size={16}
                  />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search by name, description, or type..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[#141416] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 focus:bg-[#1A1A1C] transition-all"
                  />
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto flex-1 p-2">
                {filteredItems.length > 0 ? (
                  <div className="space-y-1">
                    {filteredItems.map((item) => (
                      <motion.div
                        layout
                        key={item.id}
                        className="group relative flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer border border-transparent hover:border-white/5"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold border border-white/5',
                              item.type === 'SaaS'
                                ? 'bg-blue-500/10 text-blue-400'
                                : item.type === 'Dashboard'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : item.type === 'Portfolio'
                                    ? 'bg-purple-500/10 text-purple-400'
                                    : 'bg-neutral-800 text-neutral-400'
                            )}
                          >
                            {item.type.substring(0, 2).toUpperCase()}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">
                                {item.title}
                              </span>
                              {item.pinned && (
                                <Pin
                                  size={10}
                                  className="text-neutral-500"
                                  fill="currentColor"
                                />
                              )}
                            </div>
                            <div className="text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors line-clamp-1 max-w-[300px]">
                              {item.description}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-xs text-neutral-600 font-mono group-hover:text-neutral-500 transition-colors">
                            {item.time}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                            <button
                              className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                              title="Open"
                            >
                              <ArrowUpRight size={14} />
                            </button>
                            <button
                              className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                              title="Pin"
                            >
                              <Pin size={14} />
                            </button>
                            <button
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 opacity-50">
                    <Search size={32} />
                    <p className="text-sm">No projects found</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-[#09090B] border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                <div className="flex gap-4">
                  <span>Sorted by recent</span>
                  <span>{filteredItems.length} items</span>
                </div>
                <div className="flex gap-2">
                  <span className="bg-white/5 px-1.5 py-0.5 rounded text-neutral-400">
                    ⌘ K
                  </span>
                  <span>to toggle</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
