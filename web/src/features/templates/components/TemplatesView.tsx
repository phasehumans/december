import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icons } from '@/shared/components/ui/Icons'
import { DUMMY_TEMPLATES, CATEGORIES } from '../data'
import { ScrollableSection } from './ScrollableSection'
import { CategoryCard } from './CategoryCard'
import { TemplateCard } from './TemplateCard'

export const TemplatesView: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<{ id: string; label: string } | null>(null)
    const [visibleCount, setVisibleCount] = useState(6)

    const filteredGridTemplates = DUMMY_TEMPLATES.filter((template) => {
        const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              template.author.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory ? template.category === selectedCategory.id : true
        return matchesSearch && matchesCategory
    })

    const visibleTemplates = filteredGridTemplates.slice(0, visibleCount)

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative font-sans">
            <div className="flex-1 overflow-y-auto no-scrollbar pb-24 pt-8 md:pt-12">
                <div className="max-w-[1200px] mx-auto px-5 lg:px-8">
                    
                    {!selectedCategory ? (
                        <>
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
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value)
                                            setVisibleCount(6) // Reset pagination on search
                                        }}
                                    />
                                    {searchQuery && (
                                        <button 
                                            onClick={() => {
                                                setSearchQuery('')
                                                setVisibleCount(6)
                                            }}
                                            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-neutral-500 hover:text-textMain transition-colors"
                                        >
                                            <Icons.X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <ScrollableSection title="Categories">
                                    {CATEGORIES.map((category) => (
                                        <CategoryCard 
                                            key={category.id} 
                                            category={category} 
                                            onClick={() => {
                                                setSelectedCategory(category)
                                                setVisibleCount(6) // Reset pagination
                                            }}
                                        />
                                    ))}
                                </ScrollableSection>
                            </motion.div>
                        </>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="mb-10"
                        >
                            <div className="flex items-center gap-2 text-[13px] font-medium text-neutral-500 mb-8">
                                <button onClick={() => {
                                    setSelectedCategory(null)
                                    setVisibleCount(6)
                                }} className="hover:text-textMain transition-colors">
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
                        {/* Heading adjustments */}
                        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                            <h2 className="text-[15px] font-medium text-textMain">
                                {searchQuery ? `Search Results` : selectedCategory ? "" : "Templates"}
                            </h2>
                        </div>

                        {/* Grid */}
                        {filteredGridTemplates.length > 0 ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 md:gap-x-6 gap-y-10">
                                    <AnimatePresence mode="popLayout">
                                        {visibleTemplates.map((template) => (
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
                                
                                {/* Load More Dynamic UI */}
                                {visibleCount < filteredGridTemplates.length && (
                                    <div className="mt-14 flex justify-center">
                                        <button 
                                            onClick={() => setVisibleCount((prev) => prev + 6)}
                                            className="px-6 py-2 bg-transparent text-sm font-medium text-textMain border border-white/10 rounded-lg hover:bg-white/5 hover:border-white/20 transition-all shadow-sm active:scale-95"
                                        >
                                            Load More
                                        </button>
                                    </div>
                                )}
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
