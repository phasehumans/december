import React from 'react'

import { useAppStore } from '@/app/store'
import { usePreferences } from '@/features/profile/lib/preferences'
import { playFinishSound } from '@/shared/lib/finishSound'

/**
 * Plays the finish sound when a run ends well, if the preference is on. A run ends well
 * when the phase goes from thinking or building to done. Opening a finished session sets
 * the phase from null, and a stop or an error never sets "done", so those stay silent.
 */
export const useFinishSound = (): void => {
    React.useEffect(
        () =>
            useAppStore.subscribe((state, previous) => {
                if (state.generationPhase !== 'done') return
                if (previous.generationPhase === 'done' || previous.generationPhase === null) return
                if (usePreferences.getState().soundOnFinish) playFinishSound()
            }),
        []
    )
}
