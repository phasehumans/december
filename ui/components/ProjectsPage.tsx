import React from 'react'
import { Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { ProjectCard } from './projects/ProjectCard'

// Mock Data with high-quality UI preview images and updated timestamps
const projects = [
  {
    id: 1,
    title: 'Phase Humans Final',
    description: 'Prompt-to-website generator UI.',
    updatedAt: 'Just now',
    image:
      'https://images.unsplash.com/photo-1661956602116-aa6865609028?q=80&w=2664&auto=format&fit=crop',
  },
  {
    id: 2,
    title: 'E-commerce Dashboard',
    description: 'Shopify analytics view with graphs.',
    updatedAt: '2h ago',
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2670&auto=format&fit=crop',
  },
  {
    id: 3,
    title: 'SaaS Landing Page',
    description: 'High conversion landing page.',
    updatedAt: '5h ago',
    image:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop',
  },
  {
    id: 4,
    title: 'Portfolio v2',
    description: 'Minimalist photographer portfolio.',
    updatedAt: '1d ago',
    image:
      'https://images.unsplash.com/photo-1545235617-9465d2a55698?q=80&w=2680&auto=format&fit=crop',
  },
  {
    id: 5,
    title: 'Crypto Exchange',
    description: 'Trading interface with charts.',
    updatedAt: '2d ago',
    image:
      'https://images.unsplash.com/photo-1642104704074-907c0698cbd9?q=80&w=2532&auto=format&fit=crop',
  },
  {
    id: 6,
    title: 'Medical Admin',
    description: 'Patient records management system.',
    updatedAt: '3d ago',
    image:
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=2670&auto=format&fit=crop',
  },
  {
    id: 7,
    title: 'Travel Blog',
    description: 'Clean, image-heavy blog layout.',
    updatedAt: '4d ago',
    image:
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2670&auto=format&fit=crop',
  },
  {
    id: 8,
    title: 'CRM System',
    description: 'Customer relationship management tool.',
    updatedAt: '1w ago',
    image:
      'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2670&auto=format&fit=crop',
  },
]

interface ProjectsPageProps {
  onNewProject?: () => void
  onOpenProject?: (id: number) => void
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  onNewProject,
  onOpenProject,
}) => {
  return (
    <div className="w-full h-full bg-[#050505] text-white overflow-y-auto">
      <div className="max-w-[1600px] mx-auto p-6 md:p-10 space-y-10">
        {/* Header Section */}
        <div className="flex flex-row items-end justify-between border-b border-white/5 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-display font-medium tracking-tight text-white">
              Projects
            </h1>
            <p className="text-neutral-500 text-sm font-light">
              Your collection of generated interfaces.
            </p>
          </div>

          <button
            onClick={onNewProject}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-full text-xs font-bold hover:bg-neutral-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] active:scale-95 shrink-0"
          >
            <Plus size={16} strokeWidth={3} />
            New Project
          </button>
        </div>

        {/* Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-10 pb-20"
        >
          {projects.map((item, idx) => (
            <ProjectCard
              key={item.id}
              item={item}
              onClick={onOpenProject || (() => {})}
              index={idx}
            />
          ))}
        </motion.div>
      </div>
    </div>
  )
}
