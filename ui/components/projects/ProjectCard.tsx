import React from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, MoreHorizontal } from 'lucide-react'

interface Project {
  id: number
  title: string
  description: string
  updatedAt: string
  image: string
}

interface ProjectCardProps {
  item: Project
  onClick: (id: number) => void
  index: number
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  item,
  onClick,
  index,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => onClick(item.id)}
      className="group flex flex-col gap-4 cursor-pointer"
    >
      {/* Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl transition-all duration-500 group-hover:border-white/20 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]">
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 opacity-80 group-hover:opacity-100"
        />

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Hover Actions */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClick(item.id)
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-full text-xs font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 transition-transform active:scale-95"
            >
              Open Project <ArrowUpRight size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Top Right Menu (Visible on hover) */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={(e) => e.stopPropagation()}
            className="p-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-black/70 transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1.5 px-1">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-neutral-200 group-hover:text-white transition-colors truncate">
            {item.title}
          </h3>
          <span className="text-[10px] text-neutral-600 font-mono flex items-center gap-1.5 shrink-0">
            {item.updatedAt}
          </span>
        </div>
        <p className="text-xs text-neutral-500 line-clamp-1 group-hover:text-neutral-400 transition-colors">
          {item.description}
        </p>
      </div>
    </motion.div>
  )
}
