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
            className="shrink-0 w-[220px] rounded-xl border border-[#242323] bg-[#171615] hover:bg-[#1E1D1B] hover:border-[#383736] transition-all flex flex-col p-2 text-left group snap-start"
        >
            <div className="w-full aspect-[16/10] grid grid-cols-2 grid-rows-2 gap-1 mb-3 rounded-lg overflow-hidden relative">
                {images.map((img, i) => (
                    <div key={i} className="relative overflow-hidden bg-[#242323]">
                        <img
                            src={img}
                            alt=""
                            className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 ease-out"
                        />
                    </div>
                ))}
            </div>
            <span className="font-medium text-[13px] text-[#D6D5C9] px-1.5 pb-1 transition-colors">
                {category.label}
            </span>
        </motion.button>
    )
}
