import React from 'react'

import { PromptPlaceholder } from '@/shared/components/ui/PromptPlaceholder'

interface PromptInputPlaceholderProps {
    shouldShow: boolean
    displayText: string
}

export const PromptInputPlaceholder: React.FC<PromptInputPlaceholderProps> = ({
    shouldShow,
    displayText,
}) => {
    if (!shouldShow) {
        return null
    }

    return (
        <>
            <div className="hidden md:block absolute inset-0 pointer-events-none">
                <PromptPlaceholder displayText={displayText} />
            </div>
            <div className="md:hidden absolute inset-0 text-[#949494] pointer-events-none select-none truncate font-medium">
                Ask December to create...
            </div>
        </>
    )
}
