import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { CTAPromptInput } from '../prompt/CTAPromptInput'

export const CTASection = ({ onGetStarted }: { onGetStarted: () => void }) => {
  const [prompt, setPrompt] = useState('')

  const handleGetStarted = () => {
    if (prompt.trim()) {
      // Logic to handle the prompt when starting can be passed here or in parent
      onGetStarted()
    }
  }

  return (
    <section className="w-full py-32 px-6 bg-[#050505] border-t border-white/5 relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none opacity-40" />

      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
        {/* Left Side: Heading */}
        <div className="flex-1 text-left space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-5xl md:text-6xl font-display font-bold text-white tracking-tighter leading-[1.1]">
              Start building with <br />
              Phasehumans
            </h2>
            <p className="text-lg text-neutral-400 font-light mt-4 max-w-md leading-relaxed">
              Try it out and start building with PhaseHumans for free.
            </p>
          </motion.div>
        </div>

        {/* Right Side: Prompt Box */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex-1 w-full max-w-[520px] flex justify-end"
        >
          <CTAPromptInput
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleGetStarted}
          />
        </motion.div>
      </div>
    </section>
  )
}
