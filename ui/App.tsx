import React, { useState } from 'react'
import { Navbar } from './components/Navbar'
import { Sidebar } from './components/Sidebar'
import { OutputScreen } from './components/OutputScreen'
import { DocsPage } from './components/DocsPage'
import { ProjectsPage } from './components/ProjectsPage'
import { SettingsModal } from './components/SettingsModal'
import { HistoryModal } from './components/HistoryModal'
import { AuthModal } from './components/AuthModal'
import { ContextCanvas } from './components/ContextCanvas'
import { AnimatePresence, motion } from 'framer-motion'
import { DitherBackground } from './components/ui/dither-background'
import { CanvasItem } from './types'
import { cn } from './lib/utils'

// Landing Page Components
import { Hero } from './components/landing/Hero'
import { FeatureGrid } from './components/landing/FeatureGrid'
import { CTASection } from './components/landing/CTASection'
import { Footer } from './components/Footer'

// View State Definition
type ViewState = 'home' | 'output' | 'docs' | 'projects'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')

  const [prompt, setPrompt] = useState('')

  const [view, setView] = useState<ViewState>('home')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)

  // Modals State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Canvas State
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([])

  const handleOpenLogin = () => {
    setAuthMode('login')
    setIsAuthModalOpen(true)
  }

  const handleOpenSignup = () => {
    setAuthMode('signup')
    setIsAuthModalOpen(true)
  }

  const handleAuthSuccess = () => {
    setTimeout(() => {
      setIsAuthModalOpen(false)
      setIsAuthenticated(true)
    }, 800)
  }

  const handleGenerate = () => {
    if (!prompt) return

    if (!isAuthenticated) {
      handleOpenSignup()
      return
    }

    setIsGenerating(true)
    setView('output')

    setTimeout(() => {
      setIsGenerating(false)
    }, 3500)
  }

  const handleNewProject = () => {
    setPrompt('')
    setView('home')
    setIsGenerating(false)
    setCanvasItems([])
  }

  const handleOpenProject = (id: number) => {
    // Simulate opening a project
    setView('output')
    setIsGenerating(false)
  }

  const handleNavigate = (action: string) => {
    switch (action) {
      case 'home':
        setView('home')
        break
      case 'projects':
        setView('projects')
        break
      case 'history':
        // Fallback if accessed via other means, though currently mapped to projects in sidebar
        setView('projects')
        break
      case 'settings':
        setIsSettingsOpen(true)
        break
      case 'docs':
        setView('docs')
        break
      default:
        break
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setIsSettingsOpen(false)
    setView('home')
    setPrompt('')
    setCanvasItems([])
  }

  const handleAddCanvasItem = (item: CanvasItem) => {
    setCanvasItems((prev) => [...prev, item])
  }

  const handleRemoveCanvasItem = (id: string) => {
    setCanvasItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleImageUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (content) {
        const newItem: CanvasItem = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'image',
          content,
          x: Math.random() * 200 + 100,
          y: Math.random() * 200 + 100,
          prompt: '',
        }
        handleAddCanvasItem(newItem)

        // If user is not authenticated, we might want to still show it in the demo canvas on home
        // which is handled by passing canvasItems to the demo ContextCanvas
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/20 overflow-x-hidden relative flex flex-col">
      {/* Navbar - Visible when NOT authenticated and on Home */}
      {!isAuthenticated && view === 'home' && (
        <Navbar
          isAuthenticated={isAuthenticated}
          onLogin={handleOpenLogin}
          onSignup={handleOpenSignup}
        />
      )}

      {/* Sidebar - Visible when authenticated and NOT on output */}
      {isAuthenticated && view !== 'output' && (
        <Sidebar
          onLogout={handleLogout}
          isCollapsed={isSidebarCollapsed}
          toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          currentView={view}
          onNavigate={(viewName) => handleNavigate(viewName)}
          onNewProject={handleNewProject}
        />
      )}

      {/* Main Layout Area */}
      <main
        className={cn(
          'relative flex-1 transition-all duration-300 ease-in-out flex flex-col z-10',
          isAuthenticated && view !== 'output'
            ? isSidebarCollapsed
              ? 'pl-[70px]'
              : 'pl-[260px]'
            : 'pl-0'
        )}
      >
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <>
              {/* Background Layer - Fixed and independent of scroll */}
              <motion.div
                key="home-bg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-0 pointer-events-none"
              >
                <DitherBackground />
                {/* Gradient overlay to blend bottom */}
                <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-black to-transparent" />
              </motion.div>

              {/* Scrollable Content Layer */}
              <motion.div
                key="home-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col w-full relative z-10"
              >
                {/* Scrollable Content */}
                <div className="relative z-10 w-full flex flex-col">
                  {/* Hero Section */}
                  <Hero
                    prompt={prompt}
                    setPrompt={setPrompt}
                    onGenerate={handleGenerate}
                    isAuthenticated={isAuthenticated}
                    onImageUpload={handleImageUpload}
                  />

                  {/* Content only for unauthenticated landing page experience */}
                  {!isAuthenticated && (
                    <div className="relative z-20 bg-black mt-16 pt-3 border-t border-white/5">
                      {/* Canvas inside the container with padding */}
                      <div className="w-full px-3 relative z-30">
                        <div className="w-full max-w-[1600px] mx-auto">
                          <ContextCanvas
                            items={canvasItems}
                            onAddItem={handleAddCanvasItem}
                            onRemoveItem={handleRemoveCanvasItem}
                          />
                        </div>
                      </div>

                      <div className="pt-24">
                        <FeatureGrid />
                        <CTASection onGetStarted={handleOpenSignup} />
                        <Footer />
                      </div>
                    </div>
                  )}

                  {/* Context Canvas - Only if Authenticated */}
                  {isAuthenticated && (
                    <div
                      id="context-canvas-section"
                      className="w-full pb-2 px-2 pt-0 border-t border-white/5 bg-black relative z-10 mt-6"
                    >
                      <div className="w-full max-w-full mx-auto mt-2">
                        <ContextCanvas
                          items={canvasItems}
                          onAddItem={handleAddCanvasItem}
                          onRemoveItem={handleRemoveCanvasItem}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}

          {view === 'output' && (
            <motion.div
              key="output"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 bg-[#000000]"
            >
              <div className="w-full h-full">
                <OutputScreen
                  onBack={() => setView('home')}
                  isGenerating={isGenerating}
                />
              </div>
            </motion.div>
          )}

          {view === 'docs' && (
            <motion.div
              key="docs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 w-full bg-[#050505] relative z-20"
            >
              <DocsPage />
            </motion.div>
          )}

          {view === 'projects' && (
            <motion.div
              key="projects"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 w-full bg-[#050505] relative z-20 h-[calc(100vh-0px)]"
            >
              <ProjectsPage
                onNewProject={handleNewProject}
                onOpenProject={handleOpenProject}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onLogout={handleLogout}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  )
}

export default App
