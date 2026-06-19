import Link from 'next/link'
import { ArrowRight, Github } from 'lucide-react'
import React from 'react'

export default function HomePage() {
    return (
        <div className="relative flex flex-col justify-center items-center flex-grow min-h-[80vh] px-4 overflow-hidden bg-[#171615] font-sans">
            {/* Ambient Dot Pattern Background */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none select-none"
                style={{
                    backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)',
                    backgroundSize: '24px 24px',
                }}
            />

            <div className="relative z-10 max-w-2xl text-center flex flex-col items-center">
                {/* Logo and Name Container */}
                <div className="mb-6 flex flex-col items-center select-none">
                    <img
                        src="/logo.png"
                        alt="December Logo"
                        className="w-16 h-16 object-contain mb-4 animate-fade-in"
                    />
                    <span className="text-[11px] font-mono tracking-widest text-[#A09F9D] uppercase font-bold bg-[#1E1D1B] border border-[#333333] px-2.5 py-1 rounded-full">
                        Developer Center
                    </span>
                </div>

                {/* Hero Title */}
                <h1 className="text-[38px] md:text-[44px] font-bold text-white tracking-tight leading-none mb-4">
                    December Docs
                </h1>

                {/* Subtitle */}
                <p className="text-[15px] md:text-[16px] text-[#A09F9D] leading-relaxed mb-8 max-w-lg font-medium">
                    Build, edit, and orchestrate applications seamlessly. Read guides and references
                    for the December AI development platform and CLI workspace.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3.5 w-full justify-center">
                    <Link
                        href="/docs/introduction"
                        className="inline-flex items-center justify-center gap-2 bg-white text-[#171615] px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#E8E8E6] transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                        Explore Docs
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a
                        href="https://github.com/phasehumans/december"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 bg-[#1E1D1B] hover:bg-[#252423] text-white border border-[#333333] px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                        <Github className="w-4 h-4" />
                        GitHub
                    </a>
                </div>
            </div>
        </div>
    )
}
