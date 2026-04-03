import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icons } from '@/shared/components/ui/Icons'
import { cn } from '@/shared/lib/utils'

const CATEGORIES = [
    { id: 'apps', label: 'Apps & Games' },
    { id: 'landing', label: 'Landing Pages' },
    { id: 'dashboards', label: 'Dashboards' },
    { id: 'components', label: 'Components' },
    { id: 'login', label: 'Login & Sign Up' },
    { id: 'ecommerce', label: 'E-commerce' },
]

const DUMMY_TEMPLATES = [
    {
        id: '1',
        title: 'AppSport',
        category: 'dashboards',
        views: '1.4K',
        likes: '157',
        author: 'shadcn',
        isFree: true,
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '2',
        title: 'Optimus - The AI platform to build and ship',
        category: 'landing',
        views: '1.1K',
        likes: '291',
        author: 'vercel',
        isFree: false,
        price: '1 Credit',
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '3',
        title: 'COMPUTE - The Platform to Build & Ship AI',
        category: 'landing',
        views: '110',
        likes: '36',
        author: 'nextjs',
        isFree: false,
        price: '1 Credit',
        image: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '4',
        title: 'Brillance SaaS Landing Page',
        category: 'landing',
        views: '12.1K',
        likes: '1.8K',
        author: 'openai',
        isFree: true,
        image: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '5',
        title: 'Shadcn Dashboard',
        category: 'dashboards',
        views: '3.2K',
        likes: '411',
        author: 'johndoe',
        isFree: true,
        image: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '6',
        title: 'Dashboard design requirements',
        category: 'dashboards',
        views: '1.9K',
        likes: '239',
        author: 'auth0',
        isFree: true,
        image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=800&h=500',
    },
]

const ScrollableSection = ({ 
    title, 
    children 
}: { 
    title: string; 
    children: React.ReactNode; 
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef
            const scrollAmount = direction === 'left' ? -400 : 400
            current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
        }
    }

    return (
        <div className="mb-16 relative group/section">
            <div className="flex items-center justify-between mb-5 px-1">
                <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
                <div className="hidden md:flex items-center gap-2 opacity-0 group-hover/section:opacity-100 transition-opacity duration-300">
                    <button 
                        onClick={() => scroll('left')} 
                        className="w-8 h-8 rounded-full bg-transparent border border-white/10 flex items-center justify-center text-white hover:bg-white/5 transition-all active:scale-95 shadow-sm"
                    >
                        <Icons.ChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                    <button 
                        onClick={() => scroll('right')} 
                        className="w-8 h-8 rounded-full bg-transparent border border-white/10 flex items-center justify-center text-white hover:bg-white/5 transition-all active:scale-95 shadow-sm"
                    >
                        <Icons.ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="-mx-6 lg:-mx-8 px-6 lg:px-8">
                <div 
                    ref={scrollContainerRef} 
                    className="flex gap-4 md:gap-5 overflow-x-auto no-scrollbar pb-4 snap-x snap-mandatory"
                    style={{ scrollBehavior: 'smooth' }}
                >
                    {children}
                </div>
            </div>
        </div>
    )
}

const TemplateCard = ({ 
    template, 
    index 
}: { 
    template: any; 
    index: number;
}) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.05, ease: [0.21, 1.02, 0.73, 1.0] }}
        className="group flex flex-col gap-3 cursor-pointer snap-start shrink-0 w-full"
    >
        {/* Image Container */}
        <div className="relative aspect-[16/10] bg-[#111] overflow-hidden rounded-xl border border-white/10 group-hover:border-white/20 transition-all duration-300">
            <img
                src={template.image}
                alt={template.title}
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out"
            />
        </div>

        {/* Content Details */}
        <div className="flex items-start justify-between gap-3 px-1">
            <div className="flex items-start gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 flex items-center justify-center text-[11px] text-white font-medium border border-white/10 shrink-0">
                    {template.author.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col overflow-hidden min-w-0 pb-1 pt-0.5">
                    <h3 className="text-[14px] font-medium text-textMain truncate leading-tight group-hover:text-white transition-colors">
                        {template.title}
                    </h3>
                    <div className="flex items-center gap-2.5 mt-1 text-[13px] text-textDim flex-wrap font-medium">
                        <span className="flex items-center gap-1.5 transition-colors group-hover:text-textMain/80">
                            <Icons.User className="w-3.5 h-3.5 opacity-70" />
                            {template.views}
                        </span>
                        <span className="flex items-center gap-1.5 transition-colors group-hover:text-textMain/80">
                            <Icons.Heart className="w-3.5 h-3.5 opacity-70" />
                            {template.likes}
                        </span>
                    </div>
                </div>
            </div>
            <div className="shrink-0 pt-0.5">
                <span className="text-[13px] font-medium text-textDim flex items-center gap-1.5">
                    {!template.isFree && <Icons.Code className="w-3.5 h-3.5 opacity-70" />}
                    {template.isFree ? 'Free' : template.price}
                </span>
            </div>
        </div>
    </motion.div>
)

export const TemplatesView: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('')

    const filteredGridTemplates = DUMMY_TEMPLATES.filter((template) => 
        template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.author.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative font-sans text-textMain">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
                    {/* Hero Header */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col items-center justify-center text-center pt-20 pb-12"
                    >
                        <h1 className="text-4xl md:text-[44px] font-semibold text-white tracking-tight mb-4">
                            Community Templates
                        </h1>
                        <p className="text-textDim text-lg mb-8 max-w-[600px] font-medium">
                            Discover websites, apps, components, and starters shared by the community — ready to remix, customize, and make your own.
                        </p>

                        <div className="relative w-full max-w-lg group">
                            <div className="absolute inset-y-0 left-0 pl-1 flex items-center pointer-events-none">
                                <Icons.Search className="h-5 w-5 text-textDim group-focus-within:text-white transition-colors" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-9 pr-4 py-3 bg-transparent border-b border-white/10 text-white placeholder-textDim focus:outline-none focus:border-white/30 transition-colors text-base font-medium"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-textDim hover:text-white transition-colors"
                                >
                                    <Icons.X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </motion.div>

                    {/* Only show categories if not searching */}
                    {searchQuery.trim() === '' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            <ScrollableSection title="Categories">
                                {CATEGORIES.map((category) => (
                                    <button
                                        key={category.id}
                                        className="shrink-0 w-[180px] h-[90px] rounded-xl border border-white/5 bg-[#141414] hover:bg-[#1A1A1A] hover:border-white/10 transition-all flex items-end p-4 text-left group"
                                    >
                                        <span className="font-medium text-[15px] text-textDim group-hover:text-white transition-colors">
                                            {category.label}
                                        </span>
                                    </button>
                                ))}
                            </ScrollableSection>
                            
                            <div className="mt-6 mb-10 h-px w-full bg-white/5" />
                        </motion.div>
                    )}

                    {/* Main Grid Section */}
                    <div>
                        {/* Toolbar */}
                        <div className="flex items-center justify-between mb-6 px-1">
                            <h2 className="text-lg font-semibold text-white tracking-tight">
                                {searchQuery ? `Search Results for "${searchQuery}"` : "Templates"}
                            </h2>
                            <div className="flex items-center gap-3">
                                <button className="flex items-center gap-2 px-3 py-1.5 bg-transparent hover:bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-textDim hover:text-white transition-all active:scale-95 shadow-sm group">
                                    Filters <Icons.ChevronDown className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
                                </button>
                                <button className="flex items-center gap-2 px-3 py-1.5 bg-transparent hover:bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-textDim hover:text-white transition-all active:scale-95 shadow-sm group">
                                    Trending <Icons.ChevronDown className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
                                </button>
                            </div>
                        </div>

                        {/* Grid - 3 columns max per user request */}
                        {filteredGridTemplates.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 md:gap-x-6 gap-y-10 md:gap-y-12">
                                <AnimatePresence mode="popLayout">
                                    {filteredGridTemplates.map((template, index) => (
                                        <motion.div
                                            key={template.id}
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <TemplateCard template={template} index={index} />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-20 text-center"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                    <Icons.Search className="w-6 h-6 text-textDim" />
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">No templates found</h3>
                                <p className="text-textDim text-[15px] max-w-sm">
                                    We couldn't find any templates matching "{searchQuery}". Try a different search term.
                                </p>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
