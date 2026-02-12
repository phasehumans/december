import React from 'react'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  Sparkles,
  Layout,
  MonitorPlay,
  Code2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface HistoryItemProps {
  id: number
  title: string
  description: string
  time: string
  type: string
}

export const HistoryItem: React.FC<{ item: HistoryItemProps }> = ({ item }) => {
  return (
    <motion.div
      layout
      className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all duration-200 cursor-pointer border border-transparent hover:border-white/5"
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border transition-colors',
          item.type === 'SaaS'
            ? 'bg-blue-500/10 border-blue-500/10 text-blue-400'
            : item.type === 'Dashboard'
              ? 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400'
              : item.type === 'Portfolio'
                ? 'bg-purple-500/10 border-purple-500/10 text-purple-400'
                : 'bg-neutral-800 border-white/5 text-neutral-400'
        )}
      >
        {item.type === 'SaaS' ? (
          <Sparkles size={18} />
        ) : item.type === 'Dashboard' ? (
          <Layout size={18} />
        ) : item.type === 'Landing' ? (
          <MonitorPlay size={18} />
        ) : (
          <Code2 size={18} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <h3 className="text-sm font-medium text-neutral-200 group-hover:text-white truncate transition-colors">
            {item.title}
          </h3>
          <span className="text-[10px] text-neutral-600 font-mono shrink-0">
            {item.time}
          </span>
        </div>
        <p className="text-xs text-neutral-500 truncate group-hover:text-neutral-400 transition-colors">
          {item.description}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
        <button
          className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Open"
        >
          <ArrowUpRight size={16} />
        </button>
      </div>
    </motion.div>
  )
}
