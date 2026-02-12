import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight } from 'lucide-react'
import { Logo } from './Logo'

// Google Icon Component
const GoogleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
      <path
        fill="#ffffff"
        d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
      />
      <path
        fill="#ffffff"
        d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.464 63.239 -14.754 63.239 Z"
      />
      <path
        fill="#ffffff"
        d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -21.484 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
      />
      <path
        fill="#ffffff"
        d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.799 L -6.744 42.389 C -8.804 40.469 -11.514 39.239 -14.754 39.239 C -19.464 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"
      />
    </g>
  </svg>
)

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'signup'
  onAuthSuccess: () => void
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onAuthSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>(initialMode)

  // Sync internal state with prop if needed when modal opens
  React.useEffect(() => {
    if (isOpen) setAuthMode(initialMode)
  }, [isOpen, initialMode])

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAuthSuccess()
  }

  const handleGoogleAuth = () => {
    onAuthSuccess()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-[340px] bg-[#09090b] border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden ring-1 ring-white/5"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>

            <div className="flex flex-col items-center mb-6">
              <div className="mb-4 scale-75 origin-bottom">
                <Logo showText={false} />
              </div>
              <h2 className="text-base font-medium text-white tracking-tight text-center">
                {authMode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-[11px] text-neutral-500 mt-1 text-center font-medium">
                Enter your credentials to continue
              </p>
            </div>

            {/* Google Button */}
            <button
              onClick={handleGoogleAuth}
              className="w-full h-9 flex items-center justify-center gap-2 bg-[#18181b] hover:bg-[#202022] border border-white/10 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-2 py-4">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-[10px] text-neutral-700 font-bold">OR</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div className="space-y-2">
                <input
                  type="email"
                  required
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 transition-all font-mono"
                  placeholder="name@example.com"
                />

                <input
                  type="password"
                  required
                  className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 transition-all font-mono"
                  placeholder="password"
                />
              </div>

              <button
                type="submit"
                className="w-full h-9 mt-1 bg-white text-black hover:bg-neutral-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
              >
                <span>{authMode === 'login' ? 'Log in' : 'Sign up'}</span>
                <ArrowRight size={12} />
              </button>
            </form>

            <div className="mt-5 text-center">
              <p className="text-[10px] text-neutral-500 font-medium">
                {authMode === 'login' ? 'No account? ' : 'Has account? '}
                <button
                  onClick={() =>
                    setAuthMode(authMode === 'login' ? 'signup' : 'login')
                  }
                  className="text-white hover:text-neutral-300 transition-colors ml-1 underline decoration-white/20 underline-offset-2"
                >
                  {authMode === 'login' ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
