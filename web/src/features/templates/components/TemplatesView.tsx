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
        id: '1', title: 'AppSport', category: 'dashboards', views: '1.4K', likes: '157', author: 'shadcn', isFree: true,
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '2', title: 'Optimus - The AI platform to build and ship', category: 'landing', views: '1.1K', likes: '291', author: 'vercel', isFree: false, price: '1 Credit',
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '3', title: 'COMPUTE - The Platform to Build & Ship AI', category: 'landing', views: '110', likes: '36', author: 'nextjs', isFree: false, price: '1 Credit',
        image: 'https://images.unsplash.com/photo-1618761714954-0b8cd0026356?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '4', title: 'Brillance SaaS Landing Page', category: 'landing', views: '12.1K', likes: '1.8K', author: 'openai', isFree: true,
        image: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '5', title: 'Shadcn Dashboard', category: 'dashboards', views: '3.2K', likes: '411', author: 'johndoe', isFree: true,
        image: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '6', title: 'Dashboard design requirements', category: 'dashboards', views: '1.9K', likes: '239', author: 'auth0', isFree: true,
        image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '7', title: 'Healthcare Management Portal', category: 'dashboards', views: '8.4K', likes: '912', author: 'ui_guy', isFree: true,
        image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '8', title: 'Web3 Crypto Wallet', category: 'apps', views: '45.1K', likes: '4.2K', author: 'block_dev', isFree: false, price: '2 Credits',
        image: 'https://images.unsplash.com/photo-1621504450181-5d156f082e6c?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '9', title: 'Pointer AI landing page', category: 'landing', views: '18.9K', likes: '1.7K', author: 'pointer_inc', isFree: true,
        image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '10', title: 'E-commerce Modern Storefront', category: 'ecommerce', views: '6.2K', likes: '840', author: 'shop_master', isFree: true,
        image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '11', title: 'Creative Agency Portfolio', category: 'landing', views: '2.1K', likes: '188', author: 'design_studio', isFree: false, price: '1 Credit',
        image: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&q=80&w=800&h=500',
    },
    {
        id: '12', title: 'Social Media Analytics', category: 'dashboards', views: '5.5K', likes: '621', author: 'data_viz', isFree: true,
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800&h=500',
    },
]

const ScrollableSection = ({ 
    title, 
    children,
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
        <div className="mb-14 relative group/section">
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-[17px] font-medium text-textMain">{title}</h2>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => scroll('left')} 
                        className="w-8 h-8 rounded-full bg-transparent border border-white/10 flex items-center justify-center text-textMain hover:bg-white/5 transition-all active:scale-95 shadow-sm"
                    >
                        <Icons.ChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                    <button 
                        onClick={() => scroll('right')} 
                        className="w-8 h-8 rounded-full bg-transparent border border-white/10 flex items-center justify-center text-textMain hover:bg-white/5 transition-all active:scale-95 shadow-sm"
                    >
                        <Icons.ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="-mx-5 lg:-mx-8 px-5 lg:px-8">
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

const CategoryCard = ({ category, onClick }: { category: any; onClick: () => void }) => {
    // Get generic images based on category ID for the mock grid
    const getMockImages = (catId: string) => {
        const fallbacks = [
            'https://images.unsplash.com/photo-1618761714954-0b8cd0026356',
            'https://images.unsplash.com/photo-1555421689-491a97ff2040',
            'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5',
            'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d',
        ]
        const categoryTemps = DUMMY_TEMPLATES.filter(t => t.category === catId).map(t => t.image)
        while(categoryTemps.length < 4) {
            categoryTemps.push(fallbacks[categoryTemps.length % fallbacks.length] + '?auto=format&fit=crop&q=80&w=300&h=200')
        }
        return categoryTemps.slice(0, 4)
    }

    const images = getMockImages(category.id)

    return (
        <motion.button
            whileHover={{ y: -2 }}
            onClick={onClick}
            className="shrink-0 w-[240px] rounded-xl border border-white/10 bg-[#121212] hover:bg-[#181818] hover:border-white/20 transition-all flex flex-col p-2 text-left group snap-start shadow-sm"
        >
            <div className="w-full aspect-[16/10] grid grid-cols-2 grid-rows-2 gap-1 mb-3 rounded-lg overflow-hidden relative">
               {images.map((img, i) => (
                   <div key={i} className="relative overflow-hidden bg-zinc-800">
                       <img 
                            src={img} 
                            alt="" 
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" 
                        />
                   </div>
               ))}
            </div>
            <span className="font-medium text-[14px] text-textMain px-2 pb-1 transition-colors">
                {category.label}
            </span>
        </motion.button>
    )
}

const TemplateCard = ({ template }: { template: any }) => (
    <div className="group flex flex-col gap-3 cursor-pointer w-full">
        {/* Image Container with Hover Overlay */}
        <div className="relative aspect-[16/10] bg-[#111] overflow-hidden rounded-xl border border-white/10 group-hover:border-white/20 transition-all duration-300 shadow-sm">
            <img
                src={template.image}
                alt={template.title}
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out"
            />
            {/* Hover overlay for Use Template */}
            <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex items-center justify-center">
                <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white/90 text-black border border-white/10 shadow-xl h-10 px-5 rounded-full text-[14px] font-semibold transition-colors flex items-center gap-2"
                >
                    Use Template
                </motion.button>
            </div>
        </div>

        {/* Content Details */}
        <div className="flex flex-col gap-1 px-1">
            <h3 className="text-[15px] font-medium text-textMain truncate leading-tight group-hover:text-white transition-colors">
                {template.title}
            </h3>
            
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 text-[13px] text-neutral-500 font-medium">
                    <span className="hover:text-white transition-colors cursor-pointer">@{template.author}</span>
                    <span className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                        <Icons.Heart className="w-3.5 h-3.5" />
                        {template.likes}
                    </span>
                </div>
                <div className="text-[13px] font-medium text-neutral-500">
                    {template.isFree ? 'Free' : template.price}
                </div>
            </div>
        </div>
    </div>
)

export const TemplatesView: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<{ id: string; label: string } | null>(null)

    const filteredGridTemplates = DUMMY_TEMPLATES.filter((template) => {
        const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              template.author.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory ? template.category === selectedCategory.id : true
        return matchesSearch && matchesCategory
    })

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative font-sans">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-24 pt-8 md:pt-12">
                <div className="max-w-[1200px] mx-auto px-5 lg:px-8">
                    
                    {!selectedCategory ? (
                        <>
                            {/* General Header matching ProjectsView Phasehumans typography */}
                            <div className="mb-10 flex flex-col items-start gap-5">
                                <div className="flex flex-col gap-2">
                                    <h1 className="text-3xl font-medium tracking-tight text-textMain">Community Templates</h1>
                                    <p className="max-w-xl text-sm leading-relaxed text-neutral-500">
                                        Discover websites, apps, components, and starters shared by the community — ready to remix, customize, and make your own.
                                    </p>
                                </div>
                                
                                <div className="relative w-full max-w-sm mt-2">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Icons.Search className="h-4 w-4 text-neutral-400" />
                                    </div>
                                    <input
                                        type="text"
                                        className="block w-full pl-9 pr-8 py-2 bg-zinc-900/50 border border-white/10 rounded-lg text-textMain placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:bg-zinc-900 focus:ring-1 focus:ring-white/10 transition-all text-[13px] shadow-sm"
                                        placeholder="Search templates..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button 
                                            onClick={() => setSearchQuery('')}
                                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-neutral-500 hover:text-textMain transition-colors"
                                        >
                                            <Icons.X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Categories Slider */}
                            {searchQuery.trim() === '' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <ScrollableSection title="Categories">
                                        {CATEGORIES.map((category) => (
                                            <CategoryCard 
                                                key={category.id} 
                                                category={category} 
                                                onClick={() => setSelectedCategory(category)}
                                            />
                                        ))}
                                    </ScrollableSection>
                                </motion.div>
                            )}
                        </>
                    ) : (
                        // Category Inner View
                        <motion.div 
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="mb-10"
                        >
                            <div className="flex items-center gap-2 text-[13px] font-medium text-neutral-500 mb-8">
                                <button onClick={() => setSelectedCategory(null)} className="hover:text-textMain transition-colors">
                                    Templates
                                </button>
                                <Icons.ChevronRight className="w-3.5 h-3.5 opacity-60" />
                                <span className="text-textMain">{selectedCategory.label}</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <h1 className="text-3xl font-medium tracking-tight text-textMain">{selectedCategory.label}</h1>
                                <p className="max-w-xl text-[14.5px] leading-relaxed text-neutral-500">
                                    Explore {selectedCategory.label.toLowerCase()} templates built with the community. Launch high-converting pages with responsive layouts and on-brand design.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Main Grid Section */}
                    <div>
                        {/* Removed filters and trending toolbar based on request, kept only the heading conditionally */}
                        {(searchQuery || selectedCategory) && (
                            <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                                <h2 className="text-[14px] font-medium text-textMain">
                                    {searchQuery ? `Search Results` : ""}
                                </h2>
                            </div>
                        )}

                        {/* Grid */}
                        {filteredGridTemplates.length > 0 ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 md:gap-x-6 gap-y-10">
                                    <AnimatePresence mode="popLayout">
                                        {filteredGridTemplates.map((template) => (
                                            <motion.div
                                                key={template.id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.98 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.98 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <TemplateCard template={template} />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                                <div className="mt-14 flex justify-center">
                                    <button className="px-6 py-2 bg-transparent text-sm font-medium text-textMain border border-white/10 rounded-lg hover:bg-white/5 hover:border-white/20 transition-all shadow-sm active:scale-95">
                                        Load More
                                    </button>
                                </div>
                            </>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-20 text-center"
                            >
                                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-4 text-neutral-500">
                                    <Icons.Search className="w-5 h-5" />
                                </div>
                                <h3 className="text-sm font-medium text-textMain mb-1.5">No templates found</h3>
                                <p className="text-neutral-500 text-[13px] max-w-sm">
                                    We couldn't find any templates for this criteria.
                                </p>
                            </motion.div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    )
}
