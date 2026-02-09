import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
    title: string;
    description: string;
    className?: string;
    children?: React.ReactNode;
    delay?: number;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({ 
    title, 
    description, 
    className, 
    children,
    delay = 0
}) => (
    <motion.div 
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px" }}
        transition={{ delay: delay * 0.5, duration: 0.3, ease: "easeOut" }}
        className={cn(
            "group relative overflow-hidden rounded-[32px] border border-white/5 bg-[#080808] flex flex-col transition-all duration-500",
            "hover:bg-[#0A0A0A] hover:border-white/10 hover:shadow-[0_0_50px_-12px_rgba(255,255,255,0.05)]",
            className
        )}
    >
        {/* Header Section - Padded */}
        <div className="relative z-20 px-8 pt-8 pb-6 pointer-events-none">
            <h3 className="text-2xl font-display font-medium text-white tracking-tight mb-3 leading-tight drop-shadow-sm">
                {title}
            </h3>
            
            <p className="text-sm text-neutral-400 leading-relaxed font-medium max-w-[90%] tracking-wide">
                {description}
            </p>
        </div>
        
        {/* Visual Container - Full Bleed */}
        <div className="flex-1 w-full relative overflow-hidden bg-[#030303]/50 border-t border-white/5">
            {children}
        </div>
    </motion.div>
);