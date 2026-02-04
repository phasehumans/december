import React from 'react';
import { Github } from 'lucide-react';
import { Logo } from './Logo';

// Custom X (Twitter) Icon
const XIcon = ({ size = 20, className }: { size?: number, className?: string }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className}
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

interface NavbarProps {
  isAuthenticated: boolean;
  onLogin: () => void;
  onSignup: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isAuthenticated, onLogin, onSignup }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 h-20 flex items-center justify-between px-6 md:px-12 z-50 bg-transparent transition-all duration-300">
      <div className="flex items-center gap-8">
        <Logo />
        
        {/* Tagline - Only visible when NOT authenticated */}
        {!isAuthenticated && (
            <span className="hidden lg:block text-sm text-neutral-500 font-medium tracking-wide">
                humans. technology.
            </span>
        )}
        
        {/* Desktop Links - Only visible when NOT authenticated */}
        {/* {!isAuthenticated && (
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400">
                <a href="#" className="hover:text-white transition-colors">Solutions</a>
                <a href="#" className="hover:text-white transition-colors">Enterprise</a>
                <a href="#" className="hover:text-white transition-colors">Pricing</a>
                <a href="#" className="hover:text-white transition-colors">Community</a>
                <a href="#" className="hover:text-white transition-colors">Discover</a>
            </div>
        )} */}
      </div>

      <div className="flex items-center gap-4">
         {!isAuthenticated && (
            <>
                <div className="flex items-center gap-2 mr-2">
                    <a 
                        href="https://x.com/phasehumans" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 text-neutral-400 hover:text-white transition-colors hover:bg-white/5 rounded-full"
                        aria-label="X (Twitter)"
                    >
                        <XIcon size={18} />
                    </a>
                    <a 
                        href="https://github.com/phasehumans" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 text-neutral-400 hover:text-white transition-colors hover:bg-white/5 rounded-full"
                        aria-label="GitHub"
                    >
                        <Github size={20} />
                    </a>
                </div>
                <button 
                    onClick={onLogin}
                    className="text-sm font-medium text-white hover:text-neutral-300 transition-colors px-3 py-2"
                >
                    Log in
                </button>
                <button 
                    onClick={onSignup}
                    className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-full hover:bg-neutral-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                    Get started
                </button>
            </>
        )}
        {isAuthenticated && (
             <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center cursor-pointer hover:border-white/30 transition-colors">
                <span className="text-xs font-medium text-neutral-400">U</span>
             </div>
        )}
      </div>
    </nav>
  );
};