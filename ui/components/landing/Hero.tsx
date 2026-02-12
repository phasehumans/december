import React from 'react'
import { motion } from 'framer-motion'
import { MainPromptInput } from '../prompt/MainPromptInput'

interface HeroProps {
  prompt: string
  setPrompt: (value: string) => void
  onGenerate: () => void
  isAuthenticated: boolean
  onImageUpload?: (file: File) => void
}

export const Hero: React.FC<HeroProps> = ({
  prompt,
  setPrompt,
  onGenerate,
  isAuthenticated,
  onImageUpload,
}) => {
  return (
    <section className="relative w-full flex flex-col items-center justify-center pt-40 pb-44 px-4 z-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center text-center space-y-12"
      >
        {/* Headline - One line, no subheading */}
        <h1 className="text-4xl md:text-5xl font-display font-medium tracking-tight text-white max-w-[90%] md:max-w-[80%] leading-tight">
          What should we <span className="text-neutral-500">build</span>{' '}
          together?
        </h1>

        {/* Prompt Box */}
        <MainPromptInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={onGenerate}
          onImageUpload={onImageUpload}
        />
      </motion.div>
    </section>
  )
}
