import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

const CATEGORIES = [
    { id: 'apps', label: 'Apps & Games', gradient: 'from-blue-500/20 to-purple-500/20' },
    { id: 'landing', label: 'Landing Pages', gradient: 'from-orange-500/20 to-red-500/20' },
    { id: 'dashboards', label: 'Dashboards', gradient: 'from-green-500/20 to-emerald-500/20' },
    { id: 'components', label: 'Components', gradient: 'from-violet-500/20 to-indigo-500/20' },
    { id: 'login', label: 'Login & Sign Up', gradient: 'from-pink-500/20 to-rose-500/20' },
]

const DUMMY_TEMPLATES = [
    {
        id: '1',
        title: 'SaaS Dashboard Pro',
        category: 'dashboards',
        views: '12.4K',
        likes: '1.2K',
        author: 'shadcn',
        isFree: true,
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800&h=600',
    },
    {
        id: '2',
        title: 'Modern Landing Page',
        category: 'landing',
        views: '8.2K',
        likes: '856',
        author: 'vercel',
        isFree: true,
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800&h=600',
    },
    {
        id: '3',
        title: 'E-commerce Starter',
        category: 'apps',
        views: '5.6K',
        likes: '420',
        author: 'nextjs',
        isFree: true,
        image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=800&h=600',
    },
    {
        id: '4',
        title: 'AI Chat Interface',
        category: 'apps',
        views: '15.1K',
        likes: '2.4K',
        author: 'openai',
        isFree: true,
        image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800&h=600',
    },
    {
        id: '5',
        title: 'Portfolio Classic',
        category: 'landing',
        views: '3.4K',
        likes: '150',
        author: 'johndoe',
        isFree: false,
        price: '1 Credit',
        image: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&q=80&w=800&h=600',
    },
    {
        id: '6',
        title: 'Authentication Flow',
        category: 'login',
        views: '6.7K',
        likes: '532',
        author: 'auth0',
        isFree: true,
        image: 'https://images.unsplash.com/photo-1555421689-491a97ff2040?auto=format&fit=crop&q=80&w=800&h=600',
    },
    {
        id: '7',
        title: 'Kanban Board App',
        category: 'apps',
        views: '9.1K',
        likes: '780',
        author: 'trello',
        isFree: true,
        image: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?auto=format&fit=crop&q=80&w=800&h=600',
    },
    {
        id: '8',
        title: 'Fluid Animations',
        category: 'components',
        views: '4.2K',
        likes: '310',
        author: 'framer',
        isFree: false,
        price: '1 Credit',
        image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800&h=600',
    },
]

const FEATURED_TEMPLATES = DUMMY_TEMPLATES.slice(0, 3)

const TemplateCard = ({ template, index }: { template: any; index: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className="group flex flex-col gap-3 cursor-pointer"
    >
        {/* Image Container */}
        <div className="relative aspect-[16/10] bg-[#111] overflow-hidden rounded-xl border border-white/10 group-hover:border-white/20 transition-all">
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center backdrop-blur-sm">
                <button className="bg-[#1A1A1A] hover:bg-[#252525] text-white border border-white/10 shadow-lg h-9 px-4 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                    View Details
                </button>
            </div>
            <img
                src={template.image}
                alt={template.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
        </div>

        {/* Content Details */}
        <div className="flex items-start justify-between gap-3 px-1">
            <div className="flex items-start gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 flex items-center justify-center text-xs text-white font-medium border border-white/10 shadow-sm shrink-0">
                    {template.author.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col overflow-hidden min-w-0 pb-1">
                    <h3 className="text-[15px] font-semibold text-textMain truncate leading-tight group-hover:text-white transition-colors">
                        {template.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 text-[13px] text-textDim flex-wrap">
                        <span className="flex items-center gap-1.5">
                            <Icons.User className="w-3.5 h-3.5 opacity-70" />
                            {template.views}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Icons.Heart className="w-3.5 h-3.5 opacity-70" />
                            {template.likes}
                        </span>
                    </div>
                </div>
            </div>
            <div className="shrink-0 pt-0.5">
                <span className="text-[13px] font-medium text-textDim">
                    {template.isFree ? 'Free' : template.price}
                </span>
            </div>
        </div>
    </motion.div>
)

export const TemplatesView: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('')

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative font-sans text-textMain">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
                    {/* Hero Header */}
                    <div className="flex flex-col items-center justify-center text-center pt-24 pb-16">
                        <h1 className="text-4xl md:text-[44px] font-bold text-white tracking-tight mb-4">
                            Duplicate a Template
                        </h1>
                        <p className="text-[#A1A1AA] text-lg mb-10 max-w-xl">
                            Discover the best apps, components and starters from the community.
                        </p>

                        <div className="relative w-full max-w-2xl group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Icons.Search className="h-5 w-5 text-textDim group-focus-within:text-white transition-colors" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-11 pr-4 py-3.5 bg-[#111] border border-white/10 rounded-xl text-white placeholder-textDim focus:outline-none focus:border-white/20 focus:bg-[#151515] hover:bg-[#151515] transition-colors shadow-sm"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Categories Section */}
                    <div className="mb-16">
                        <div className="flex items-center justify-between mb-5 px-1">
                            <h2 className="text-lg font-semibold text-white tracking-tight">Categories</h2>
                            <button className="text-sm font-medium text-textDim hover:text-white transition-colors flex items-center gap-1">
                                Browse All <Icons.ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x">
                            {CATEGORIES.map((category) => (
                                <button
                                    key={category.id}
                                    className="relative shrink-0 w-[240px] aspect-[5/3] rounded-xl border border-white/10 overflow-hidden group snap-start bg-[#111] hover:border-white/30 transition-all text-left"
                                >
                                    <div className={cn("absolute inset-0 opacity-20 bg-gradient-to-br", category.gradient)} />
                                    {/* Mock category sub-images visual */}
                                    <div className="absolute inset-2 grid grid-cols-2 grid-rows-2 gap-2 opacity-40 group-hover:opacity-60 transition-opacity">
                                        <div className="bg-white/5 rounded-md" />
                                        <div className="bg-white/10 rounded-md" />
                                        <div className="bg-white/10 rounded-md" />
                                        <div className="bg-white/5 rounded-md" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                                        <span className="font-semibold text-white drop-shadow-sm">
                                            {category.label}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Featured Templates Section */}
                    <div className="mb-16">
                        <h2 className="text-lg font-semibold text-white tracking-tight mb-5 px-1">Featured Templates</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {FEATURED_TEMPLATES.map((template, index) => (
                                <TemplateCard key={template.id} template={template} index={index} />
                            ))}
                        </div>
                        <div className="mt-12 h-px w-full bg-white/5" />
                    </div>

                    {/* Main Grid Section */}
                    <div>
                        {/* Toolbar */}
                        <div className="flex items-center justify-between mb-8 px-1">
                            <button className="flex items-center gap-2 px-3 py-2 bg-[#1A1A1A] hover:bg-[#222] border border-white/10 rounded-lg text-sm font-medium text-white transition-colors">
                                Filters <Icons.ChevronDown className="w-4 h-4 text-textDim" />
                            </button>
                            <button className="flex items-center gap-2 px-3 py-2 bg-[#1A1A1A] hover:bg-[#222] border border-white/10 rounded-lg text-sm font-medium text-white transition-colors">
                                Trending <Icons.ChevronDown className="w-4 h-4 text-textDim" />
                            </button>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
                            {DUMMY_TEMPLATES.map((template, index) => (
                                <TemplateCard key={template.id} template={template} index={index} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
