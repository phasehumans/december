import React from 'react'
import { Download, Github, Globe } from 'lucide-react'
import { Button } from '@/shared/components/ui/Button'

export const OutputHeaderActions: React.FC = () => {
    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    title="Download Code"
                    className="text-[#91908F] hover:text-white hidden md:flex"
                >
                    <Download size={16} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    title="Sync to GitHub"
                    className="text-[#91908F] hover:text-white hidden md:flex"
                >
                    <Github size={16} />
                </Button>

                <Button
                    variant="primary"
                    size="sm"
                    className="ml-1 shadow-lg shadow-white/5 bg-white hover:bg-neutral-200 text-black border-none rounded-xl font-semibold hidden md:flex"
                >
                    <Globe size={14} className="mr-2" />
                    Publish
                </Button>
            </div>
        </div>
    )
}
