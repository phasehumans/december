import React from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

export const RepoSyncVisual = () => {
  return (
    <div className="absolute inset-0 bg-[#050505] font-mono text-[13px] p-8 flex flex-col justify-center">
      {/* Terminal Header Dots */}
      <div className="absolute top-4 left-4 flex gap-2 opacity-30">
        <div className="w-3 h-3 rounded-full bg-white/20" />
        <div className="w-3 h-3 rounded-full bg-white/20" />
      </div>

      <div className="space-y-4 max-w-lg">
        {/* Command 1 */}
        <div className="flex gap-3 items-center group">
          <span className="text-blue-500 font-bold">➜</span>
          <span className="text-neutral-300 group-hover:text-white transition-colors">
            git push origin main
          </span>
        </div>

        {/* Output */}
        <div className="space-y-2 pl-6 border-l-2 border-white/5 text-neutral-500">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            Enumerating objects: 8, done.
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            Writing objects: 100% (8/8), 1.2 KiB | 1.20 MiB/s
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="text-emerald-500 font-medium flex items-center gap-2 pt-1"
          >
            <Check size={14} strokeWidth={3} />
            remote: Resolving deltas: 100% (3/3)
          </motion.div>
        </div>
      </div>

      {/* Subtle Glint */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[100px] pointer-events-none rounded-full -translate-y-1/2 translate-x-1/2" />
    </div>
  )
}
