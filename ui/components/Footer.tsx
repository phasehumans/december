import React from 'react';
import { 
    Github, 
    Youtube
} from 'lucide-react';
import { Logo } from './Logo';
import { FooterColumn, FooterLink, SocialLink, XIcon } from './footer/FooterComponents';

export const Footer = () => {
    return (
        <footer className="w-full bg-[#050505] pt-24 pb-12 border-t border-white/5 relative overflow-hidden">
            
            {/* Ambient Background Glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-[1400px] w-full mx-auto px-6 relative z-10">
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-20">
                    
                    {/* Brand Column */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <Logo />
                        <p className="text-neutral-500 text-sm leading-relaxed max-w-sm font-medium">
                            PhaseHumans is an interface synthesis engine bridging the gap between natural language intent and high-fidelity production code.
                        </p>
                        
                        <div className="flex items-center gap-3 mt-2">
                             <SocialLink icon={XIcon} href="#" />
                             <SocialLink icon={Github} href="#" />
                             <SocialLink icon={Youtube} href="#" />
                        </div>
                    </div>

                    {/* Spacer - Increased to push columns to the right */}
                    <div className="hidden lg:block lg:col-span-4" />

                    {/* Links Columns */}
                    <div className="lg:col-span-2">
                        <FooterColumn title="Product">
                            <FooterLink href="#">Changelog</FooterLink>
                            <FooterLink href="#">Documentation</FooterLink>
                            <FooterLink href="#">Playground</FooterLink>
                            <FooterLink href="#">Pricing</FooterLink>
                        </FooterColumn>
                    </div>

                    <div className="lg:col-span-2">
                        <FooterColumn title="Company">
                            <FooterLink href="#">About</FooterLink>
                            <FooterLink href="#">Careers</FooterLink>
                            <FooterLink href="#">Blog</FooterLink>
                            <FooterLink href="#">Contact</FooterLink>
                        </FooterColumn>
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <span className="text-xs text-neutral-600 font-medium">
                        &copy; {new Date().getFullYear()} PhaseHumans Inc.
                    </span>
                    <div className="flex items-center gap-6">
                        <a href="#" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">Privacy Policy</a>
                        <a href="#" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">Terms of Service</a>
                        <a href="#" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">Cookie Policy</a>
                    </div>
                </div>

            </div>
        </footer>
    );
};