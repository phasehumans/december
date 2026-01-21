import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
    className?: string;
    showText?: boolean;
}

export const Logo = ({ className, showText = true }: LogoProps) => {
  return (
    <div className={cn("flex items-center select-none group cursor-pointer", className)}>
      <div className="relative flex items-baseline">
        {/* Phase: Monospace, representing the digital/process state */}
        <span className="font-mono text-xl font-medium text-neutral-500 tracking-tight transition-colors duration-300 group-hover:text-neutral-400">
            phase
        </span>
        
        {/* Humans: Sans-serif, representing the user/organic state */}
        <span className="font-sans text-xl font-bold text-white tracking-tight ml-[1px]">
            humans
        </span>

        {/* Accent: A glowing point symbolizing the connection or spark */}
        <div className="relative ml-1.5">
             <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.8)] group-hover:shadow-[0_0_16px_rgba(255,255,255,1)] group-hover:scale-125 transition-all duration-300" />
        </div>
      </div>
    </div>
  );
};