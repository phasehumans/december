import React from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { referralCode } from '@/features/auth/referral'

/** /r/<code>, an invite link: keep the code for the sign-up, then show the sign-up page */
export const ReferralLanding: React.FC = () => {
    const { code } = useParams<{ code: string }>()
    // saved before the redirect renders, so the sign-up page can read it
    const hasSaved = React.useRef(false)
    if (!hasSaved.current) {
        hasSaved.current = true
        referralCode.save(code)
    }

    return <Navigate to="/signup" replace />
}
