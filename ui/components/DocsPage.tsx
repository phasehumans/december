import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Book,
  FileText,
  Terminal,
  Code,
  Cpu,
  Zap,
  Layers,
  Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CodeBlock } from './docs/CodeBlock'

const sidebarLinks = [
  {
    section: 'Getting Started',
    items: [
      { label: 'Introduction', id: 'intro', active: true },
      { label: 'Installation', id: 'install', active: false },
      { label: 'Quick Start', id: 'quick', active: false },
    ],
  },
  {
    section: 'Core Concepts',
    items: [
      { label: 'Phase Engine', id: 'engine', active: false },
      { label: 'Context Canvas', id: 'canvas', active: false },
      { label: 'Neural Bridge', id: 'neural', active: false },
    ],
  },
  {
    section: 'API Reference',
    items: [
      { label: 'REST API', id: 'rest', active: false },
      { label: 'WebSocket', id: 'ws', active: false },
      { label: 'Types', id: 'types', active: false },
    ],
  },
]

export const DocsPage = () => {
  return (
    <div className="flex w-full h-full text-white bg-[#050505] overflow-hidden">
      {/* Docs Sidebar */}
      <div className="w-64 shrink-0 border-r border-white/5 hidden lg:flex flex-col h-full overflow-y-auto bg-[#050505]">
        <div className="p-6 sticky top-0 bg-[#050505] z-10">
          <div className="flex items-center gap-2 text-neutral-200 font-medium mb-1">
            <Book size={18} />
            Documentation
          </div>
          <div className="text-xs text-neutral-500">v2.1.0</div>
        </div>

        <div className="px-6 pb-10 space-y-8">
          {sidebarLinks.map((group, idx) => (
            <div key={idx}>
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3 font-mono">
                {group.section}
              </h4>
              <ul className="space-y-0.5">
                {group.items.map((item, i) => (
                  <li
                    key={i}
                    className={cn(
                      'text-sm px-3 py-2 rounded-md cursor-pointer transition-colors block',
                      item.active
                        ? 'bg-white/10 text-white font-medium'
                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-full overflow-y-auto scroll-smooth">
        <div className="max-w-4xl mx-auto px-6 py-10 lg:px-12 lg:py-16">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4 font-mono">
              <span>Docs</span>
              <ChevronRight size={12} />
              <span className="text-neutral-200">Introduction</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-display font-bold tracking-tight text-white mb-6">
              Introduction to PhaseHumans
            </h1>
            <p className="text-xl text-neutral-400 font-light leading-relaxed max-w-2xl">
              PhaseHumans is an interface synthesis engine that bridges the gap
              between natural language intent and high-fidelity production code.
            </p>
          </div>

          <div className="space-y-12">
            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-display font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="text-yellow-500" size={24} />
                Why PhaseHumans?
              </h2>
              <p className="text-neutral-400 leading-7 mb-6">
                Traditional UI development involves a lot of boilerplate and
                repetitive setup. PhaseHumans treats UI as a function of intent.
                You describe the <em className="text-white not-italic">what</em>
                , and our engine handles the{' '}
                <em className="text-white not-italic">how</em>.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-white/10 bg-[#0A0A0A]">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mb-3">
                    <Code size={18} />
                  </div>
                  <h3 className="text-white font-medium mb-1">
                    Semantic Parsing
                  </h3>
                  <p className="text-sm text-neutral-500">
                    Understands context, framework preferences, and styling
                    constraints automatically.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-[#0A0A0A]">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-3">
                    <Layers size={18} />
                  </div>
                  <h3 className="text-white font-medium mb-1">
                    Component Hierarchy
                  </h3>
                  <p className="text-sm text-neutral-500">
                    Generates atomic components that are reusable and follow
                    best practices.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-display font-semibold text-white mb-4">
                Installation
              </h2>
              <p className="text-neutral-400 leading-7 mb-4">
                PhaseHumans is available as a CLI tool for rapid project
                scaffolding.
              </p>
              <CodeBlock code="npm install -g phase-humans-cli" />
              <p className="text-neutral-400 leading-7 mt-4 mb-4">
                Initialize a new project in your current directory:
              </p>
              <CodeBlock
                code={`phase init my-new-project\ncd my-new-project\nphase dev`}
              />
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-display font-semibold text-white mb-4">
                Architecture
              </h2>
              <p className="text-neutral-400 leading-7 mb-6">
                The core of PhaseHumans consists of three main parts: the{' '}
                <strong>Context Canvas</strong>, the{' '}
                <strong>Synthesis Engine</strong>, and the{' '}
                <strong>Renderer</strong>.
              </p>

              <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-1 overflow-hidden">
                <div className="aspect-[21/9] bg-[#050505] rounded-lg relative flex items-center justify-center border border-white/5">
                  <div className="flex items-center gap-4 text-xs font-mono text-neutral-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-12 rounded border border-neutral-700 bg-neutral-900 flex items-center justify-center">
                        Input
                      </div>
                      <span className="text-[10px]">Prompt</span>
                    </div>
                    <div className="w-8 h-px bg-neutral-700" />
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20 h-20 rounded border border-blue-500/30 bg-blue-500/5 flex items-center justify-center text-blue-400">
                        Engine
                      </div>
                      <span className="text-[10px]">Processing</span>
                    </div>
                    <div className="w-8 h-px bg-neutral-700" />
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-12 rounded border border-neutral-700 bg-neutral-900 flex items-center justify-center">
                        Output
                      </div>
                      <span className="text-[10px]">React DOM</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Footer Nav */}
          <div className="mt-20 pt-10 border-t border-white/5 flex justify-between">
            <div></div>
            <a
              href="#"
              className="group flex flex-col items-end gap-1 text-right"
            >
              <span className="text-xs text-neutral-500 font-mono">Next</span>
              <span className="text-lg text-white font-medium group-hover:text-blue-400 transition-colors flex items-center gap-2">
                Installation <ChevronRight size={18} />
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
