import React from 'react'
import { motion } from 'framer-motion'
import { Github } from 'lucide-react'

export const ContextCanvasVisual = () => {
  return (
    <div className="absolute inset-0 bg-[#050505] flex flex-col items-start overflow-hidden">
      {/* Editor Header */}
      <div className="w-full h-10 border-b border-white/5 bg-[#0A0A0A] flex items-center px-4 gap-3 z-20">
        <div className="flex gap-1.5 opacity-50">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
        </div>
        <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-2">
          <span className="text-neutral-300">project-specs.mdx</span>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
        </div>
      </div>

      {/* Editor Content */}
      <div className="w-full h-full relative z-10 p-8">
        {/* Cursor Zoe */}
        <motion.div
          initial={{ x: 100, y: 60, opacity: 0 }}
          whileInView={{ x: 0, y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8, type: 'spring' }}
          className="absolute top-12 left-[40%] z-30 pointer-events-none"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
              zoe
            </div>
          </div>
          <div className="w-0.5 h-6 bg-emerald-500 rounded-full" />
        </motion.div>

        <div className="relative z-10 space-y-6 max-w-md">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-neutral-800 rounded-md border border-white/10">
                <Github size={14} className="text-white" />
              </div>
              <span className="text-xs text-neutral-500 font-mono">
                Spice Harvester / Specs
              </span>
            </div>
            <h4 className="text-3xl font-bold text-white tracking-tight">
              <span className="bg-white/5 px-2 rounded-lg decoration-clone leading-relaxed py-1">
                Collaborate on
              </span>
              <br />
              <span className="text-neutral-500">ideas instantly.</span>
            </h4>
          </div>

          <div className="space-y-4 text-sm text-neutral-400 font-light leading-relaxed font-sans border-l-2 border-white/5 pl-4">
            <p>
              Write down product ideas and work together on feature specs in
              realtime.
            </p>
            <p className="relative">
              Add{' '}
              <span className="text-white font-medium bg-white/10 px-1 rounded">
                **style**
              </span>{' '}
              and{' '}
              <span className="text-blue-400 font-medium bg-blue-500/10 px-1 rounded">
                ##structure
              </span>{' '}
              with rich-text formatting options directly in the canvas.
            </p>
          </div>

          {/* Fake skeleton lines for "more content" */}
          <div className="space-y-3 opacity-20 pt-4">
            <div className="h-2 w-full bg-gradient-to-r from-neutral-700 to-transparent rounded-full" />
            <div className="h-2 w-5/6 bg-gradient-to-r from-neutral-700 to-transparent rounded-full" />
            <div className="h-2 w-4/6 bg-gradient-to-r from-neutral-700 to-transparent rounded-full" />
          </div>
        </div>
      </div>

      {/* Background Grid Pattern for Doc */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  )
}
