import React, { useState } from 'react'
import { Logo } from './Logo'
import { Menu, Github } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { MobileMenu } from './navbar/MobileMenu'
import { Button } from '@/components/ui/Button'

// X (Twitter) Icon SVG
const XIcon = ({ className }: { className?: string }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
)

interface NavbarProps {
  isAuthenticated: boolean
  onLogin: () => void
  onSignup: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  isAuthenticated,
  onLogin,
  onSignup,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      <nav className="absolute top-0 left-0 w-full h-20 flex items-center justify-between px-6 md:px-12 z-50 bg-transparent">
        {/* Left Side: Logo & Tagline */}
        <div className="flex items-center gap-6">
          <Logo className="scale-95 origin-left" />
          <span className="hidden sm:block text-neutral-500 text-sm font-medium tracking-wide translate-y-[1px]">
            humans. technology.
          </span>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-5 sm:gap-6">
          {/* Social Links */}
          <div className="flex items-center gap-4 pr-6 border-r border-white/10 hidden md:flex h-5">
            <a
              href="#"
              className="text-neutral-400 hover:text-white transition-colors"
              aria-label="Follow on X"
            >
              <XIcon className="w-4 h-4" />
            </a>
            <a
              href="#"
              className="text-neutral-400 hover:text-white transition-colors"
              aria-label="Star on GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            {!isAuthenticated ? (
              <>
                <Button
                  variant="ghost"
                  onClick={onLogin}
                  className="hidden sm:inline-flex text-neutral-300 hover:text-white"
                >
                  Log in
                </Button>
                <Button
                  variant="primary"
                  onClick={onSignup}
                  className="rounded-full px-5"
                >
                  Get started
                </Button>
              </>
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 border border-white/10 flex items-center justify-center cursor-pointer hover:border-white/30 transition-colors shadow-inner">
                <span className="text-xs font-bold text-neutral-300">AC</span>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden ml-1"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </Button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <MobileMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            isAuthenticated={isAuthenticated}
            onLogin={onLogin}
            onSignup={onSignup}
          />
        )}
      </AnimatePresence>
    </>
  )
}
