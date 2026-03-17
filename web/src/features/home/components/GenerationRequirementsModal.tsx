import React from 'react'
import { Modal } from '@/shared/components/ui/Modal'
import { Switch } from '@/shared/components/ui/Switch'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'
import type { GenerationRequirements } from '@/app/types'

interface GenerationRequirementsModalProps {
    isOpen: boolean
    requirements: GenerationRequirements
    errorMessage: string | null
    onClose: () => void
    onRequirementsChange: (nextRequirements: GenerationRequirements) => void
    onContinue: () => void
}

const NEON_VIDEO_URL = 'https://www.youtube.com/watch?v=Eu6Oez5ksMg'
const NEON_VIDEO_THUMBNAIL = 'https://img.youtube.com/vi/Eu6Oez5ksMg/hqdefault.jpg'

export const GenerationRequirementsModal: React.FC<GenerationRequirementsModalProps> = ({
    isOpen,
    requirements,
    errorMessage,
    onClose,
    onRequirementsChange,
    onContinue,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Database setup"
            description="Add Neon details before generation starts."
            maxWidth="max-w-[520px]"
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#242323] px-3 py-2.5">
                    <div>
                        <p className="text-sm font-medium text-white">Use database</p>
                        <p className="text-xs text-neutral-400">
                            Enable DB integration for this build.
                        </p>
                    </div>
                    <Switch
                        checked={requirements.needsDatabase}
                        onCheckedChange={(checked) =>
                            onRequirementsChange({
                                ...requirements,
                                needsDatabase: checked,
                            })
                        }
                    />
                </div>

                <Input
                    label="NeonDB URL"
                    placeholder="postgres://..."
                    value={requirements.neonDatabaseUrl}
                    onChange={(event) =>
                        onRequirementsChange({
                            ...requirements,
                            neonDatabaseUrl: event.target.value,
                        })
                    }
                />

                <a
                    href={NEON_VIDEO_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="group block overflow-hidden rounded-xl border border-white/10 bg-[#242323]"
                >
                    <div className="relative h-32 w-full">
                        <img
                            src={NEON_VIDEO_THUMBNAIL}
                            alt="How to find Neon DB URL"
                            className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="rounded-full bg-black/65 px-3 py-1 text-xs text-white border border-white/20">
                                Open video
                            </span>
                        </div>
                    </div>
                </a>

                {errorMessage && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {errorMessage}
                    </p>
                )}

                <div className="mt-4 flex items-center justify-end gap-3">
                    <Button variant="ghost" type="button" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={onContinue}>
                        Continue
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
