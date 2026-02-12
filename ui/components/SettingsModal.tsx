import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, LogOut, Loader2, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SettingsInput } from './settings/SettingsInput'
import { IntegrationCard } from './settings/IntegrationCard'
import {
  GitHubIcon,
  VercelIcon,
  NotionIcon,
  SupabaseIcon,
} from './icons/BrandIcons'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onLogout?: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onLogout,
}) => {
  const [isSaving, setIsSaving] = useState(false)
  const [isEmailEnabled, setIsEmailEnabled] = useState(true)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      onClose()
    }, 1000)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-lg bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden ring-1 ring-white/5 max-h-[85vh]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#09090b] sticky top-0 z-10 shrink-0">
                <h2 className="text-sm font-medium text-white tracking-tight">
                  Settings
                </h2>
                <button
                  onClick={onClose}
                  className="text-neutral-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-8 bg-[#09090b] overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <h3 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                    Profile
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <SettingsInput label="First Name" defaultValue="Alex" />
                    <SettingsInput label="Last Name" defaultValue="Chen" />
                  </div>
                  <SettingsInput
                    label="Email"
                    defaultValue="alex@phasehumans.ai"
                  />
                </div>

                <div className="h-px w-full bg-white/5" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-1">
                        Notifications
                      </h3>
                      <p className="text-xs text-neutral-400">
                        Receive weekly digests
                      </p>
                    </div>
                    <button
                      onClick={() => setIsEmailEnabled(!isEmailEnabled)}
                      className={cn(
                        'w-9 h-5 rounded-full relative transition-colors duration-200',
                        isEmailEnabled ? 'bg-white' : 'bg-white/10'
                      )}
                    >
                      <div
                        className={cn(
                          'w-3.5 h-3.5 bg-black rounded-full absolute top-0.5 transition-all duration-200 shadow-sm',
                          isEmailEnabled
                            ? 'left-[calc(100%-1.125rem)]'
                            : 'left-0.5 bg-neutral-400'
                        )}
                      />
                    </button>
                  </div>
                </div>

                <div className="h-px w-full bg-white/5" />

                <div className="space-y-4">
                  <h3 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                    Integrations
                  </h3>

                  <IntegrationCard
                    icon={GitHubIcon}
                    name="GitHub"
                    description="Sync repositories"
                    connected={true}
                    username="alexchen"
                    colorClass="bg-white text-black border-white"
                  />

                  <IntegrationCard
                    icon={VercelIcon}
                    name="Vercel"
                    description="Deployments"
                    connected={false}
                    colorClass="bg-black text-white border-white/20"
                  />

                  <IntegrationCard
                    icon={NotionIcon}
                    name="Notion"
                    description="Sync docs"
                    connected={false}
                    colorClass="bg-white text-black border-white/20"
                  />

                  <IntegrationCard
                    icon={SupabaseIcon}
                    name="Supabase"
                    description="Database"
                    connected={false}
                    colorClass="bg-[#3ECF8E]/10 text-[#3ECF8E] border-[#3ECF8E]/20"
                  />
                </div>
              </div>

              <div className="p-4 bg-[#0c0c0e] border-t border-white/5 flex items-center justify-between sticky bottom-0 z-10 shrink-0">
                <button
                  onClick={onLogout}
                  className="text-xs text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-1.5 px-2"
                >
                  <LogOut size={12} />
                  Sign out
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-neutral-200 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : null}
                  {isSaving ? 'Saving' : 'Save Changes'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
