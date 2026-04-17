import React from 'react'
import { motion } from 'framer-motion'

import { DUMMY_TEMPLATES } from '../data'

interface CategoryCardProps {
    category: { id: string; label: string }
    onClick: () => void
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, onClick }) => {
    const getMockImages = (catId: string) => {
        const fallbacks: string[] = [
            'https://images.unsplash.com/photo-1618761714954-0b8cd0026356',
            'https://images.unsplash.com/photo-1555421689-491a97ff2040',
            'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5',
            'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d',
        ]
        const categoryTemps: string[] = DUMMY_TEMPLATES.filter((t) => t.category === catId).map(
            (t) => t.image as string
        )
        while (categoryTemps.length < 4) {
            categoryTemps.push(fallbacks[categoryTemps.length % fallbacks.length] as string)
        }
        return categoryTemps.slice(0, 4)
    }

    const images = getMockImages(category.id)

    return (
        <motion.button
            onClick={onClick}
            className="shrink-0 w-[240px] rounded-2xl border border-white/5 bg-[#121212] hover:bg-[#181818] hover:border-white/10 transition-all flex flex-col p-2 text-left group snap-start"
        >
            <div className="w-full aspect-[16/10] grid grid-cols-2 grid-rows-2 gap-1 mb-3 rounded-xl overflow-hidden relative">
                {images.map((img, i) => (
                    <div key={i} className="relative overflow-hidden bg-zinc-800">
                        <img
                            src={img}
                            alt=""
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out"
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
