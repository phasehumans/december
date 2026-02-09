import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GitHubIcon, VercelIcon, NotionIcon, SupabaseIcon } from '@/components/icons/BrandIcons';

// Helper for Integration Icons
export const IntegrationItem = ({ icon: Icon, color, name, delay }: { icon: any, color: string, name: string, delay: number }) => (
    <motion.div 
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ delay, duration: 0.4, ease: "backOut" }}
        className="flex flex-col items-center gap-2 group cursor-pointer"
    >
        <div className={cn(
            "w-12 h-12 rounded-xl border border-white/5 flex items-center justify-center hover:scale-105 transition-all shadow-lg backdrop-blur-md",
            color
        )}>
            <Icon className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-medium text-neutral-500 group-hover:text-neutral-300 transition-colors">{name}</span>
    </motion.div>
);

export const IntegrationsVisual = () => {
    return (
        <div className="absolute inset-0 bg-[#050505] flex items-center justify-center">
            <div className="relative z-10 grid grid-cols-4 gap-6 px-6 w-full max-w-[320px]">
                <IntegrationItem icon={GitHubIcon} name="GitHub" color="bg-white/5 text-white border-white/10 group-hover:bg-white/10" delay={0.05} />
                <IntegrationItem icon={VercelIcon} name="Vercel" color="bg-black text-white border-white/10 group-hover:border-white/20" delay={0.1} />
                <IntegrationItem icon={NotionIcon} name="Notion" color="bg-white/90 text-black border-white/5 group-hover:bg-white" delay={0.15} />
                <IntegrationItem icon={SupabaseIcon} name="Supabase" color="bg-[#3ECF8E]/10 text-[#3ECF8E] border-[#3ECF8E]/20 group-hover:bg-[#3ECF8E]/20" delay={0.2} />
            </div>
            
            {/* Subtle Grid Background */}
             <div className="absolute inset-0 z-0 opacity-[0.05] pointer-events-none" 
                style={{ 
                    backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', 
                    backgroundSize: '16px 16px' 
                }} 
            />
        </div>
    );
};