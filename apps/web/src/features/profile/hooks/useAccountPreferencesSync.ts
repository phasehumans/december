import { useEffect } from 'react'

import { profileAPI, type Profile } from '@/features/profile/api/profile'
import {
    changedPreferences,
    pickPreferences,
    usePreferences,
} from '@/features/profile/lib/preferences'

/**
 * Keeps the preferences of this browser in step with the account (#636). The values saved
 * on the account win. An account with none saved gets the values this browser changed, so
 * a person who set them before this sync keeps them on every device.
 */
export const useAccountPreferencesSync = (profile: Profile | undefined) => {
    const saved = profile?.preferences
    const hasProfile = Boolean(profile)

    useEffect(() => {
        if (!hasProfile) return
        if (saved) {
            usePreferences.getState().applyPreferences(pickPreferences(saved))
            return
        }
        const state = usePreferences.getState()
        const changed = changedPreferences({
            sendKey: state.sendKey,
            soundOnFinish: state.soundOnFinish,
            messageWhileWorking: state.messageWhileWorking,
        })
        if (Object.keys(changed).length === 0) return
        profileAPI.updatePreferences(changed).catch((error: unknown) => {
            // the values stay in this browser; the next load tries again
            console.error('[preferences] could not save to the account', error)
        })
    }, [hasProfile, saved])
}
