import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { AuthModal } from '@/features/auth/components/AuthModal'
import { authPrimaryButtonClass } from '@/features/auth/components/authModalStyles'
import { AuthPageShell } from '@/features/auth/components/AuthPageShell'
import { profileAPI } from '@/features/profile/api/profile'
import { TEAM_QUERY_KEY, teamAPI, type TeamRole } from '@/features/profile/api/team'
import { LogoLoader } from '@/shared/components/ui/LogoLoader'
import { resetUserQueryCache } from '@/shared/lib/query-cache'
import { clearLoggedInCookie } from '@/shared/utils/logged-in-cookie'

// the page behind the link of a team invite mail: /invite/<token> (#640). it follows the
// device sign-in page: the logo, one grey line, then one button.
//
// the page never joins by itself: the user selects Join. the server lets only the account
// with the invited email join, so the page says which email the invite is for.

const BAD_INVITE_LINE = 'This invite is used or expired. Ask for a new one.'

const roleWords = (role: TeamRole) => (role === 'ADMIN' ? 'an admin' : 'a member')

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export const InviteAccept: React.FC = () => {
    const queryClient = useQueryClient()
    const { token = '' } = useParams<{ token: string }>()

    const [showAuthModal, setShowAuthModal] = useState(false)
    const [isJoining, setIsJoining] = useState(false)
    const [joinedTeam, setJoinedTeam] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState('')

    const {
        data: profile,
        isLoading: isProfileLoading,
        refetch: refetchProfile,
    } = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        retry: false,
    })

    // read again after sign-in: the server then says if the invite is for this account
    const {
        data: invite,
        isLoading: isInviteLoading,
        isError: isInviteMissing,
    } = useQuery({
        queryKey: ['team-invite', token, profile?.id ?? null],
        queryFn: () => teamAPI.previewInvite(token),
        enabled: Boolean(token) && !isProfileLoading,
        retry: false,
    })

    const isUsable = Boolean(invite) && !invite?.expired

    // a signed-out user who came from the mail gets the sign-in page at once
    const hasOpenedAuthRef = React.useRef(false)
    useEffect(() => {
        if (hasOpenedAuthRef.current) return
        if (isUsable && !profile && !isProfileLoading) {
            hasOpenedAuthRef.current = true
            setShowAuthModal(true)
        }
    }, [isUsable, profile, isProfileLoading])

    const join = async () => {
        setIsJoining(true)
        setErrorMessage('')
        try {
            const result = await teamAPI.acceptInvite(token)
            setJoinedTeam(result.team.name)
            void queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY })
        } catch (err: any) {
            if (err?.status === 401) {
                // the session ended: sign in again, then the user selects Join again
                queryClient.setQueryData(['profile'], null)
                setShowAuthModal(true)
            } else {
                setErrorMessage(sentence(err?.message || 'The invite did not work. Try again.'))
            }
        } finally {
            setIsJoining(false)
        }
    }

    // signing in does not join the team: the user selects Join after it
    const handleAuthSuccess = async () => {
        setShowAuthModal(false)
        await refetchProfile()
    }

    const handleSwitchAccount = async () => {
        clearLoggedInCookie()
        try {
            await profileAPI.signout()
        } catch {
            // Intentionally swallowed: the sign-in page opens even when the network fails
        }
        // also clears localStorage, so the next account never starts with this one's profile
        resetUserQueryCache(queryClient)
        queryClient.setQueryData(['profile'], null)
        setErrorMessage('')
        setShowAuthModal(true)
    }

    const authModal = (
        <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onAuthSuccess={handleAuthSuccess}
            initialMode="login"
        />
    )

    if (joinedTeam) {
        return (
            <AuthPageShell line={`You are in the team ${joinedTeam} now.`}>
                <a href="/settings/members" className={authPrimaryButtonClass}>
                    Open December
                </a>
            </AuthPageShell>
        )
    }

    if (isProfileLoading || isInviteLoading) return <LogoLoader />

    if (isInviteMissing || !invite || invite.expired) {
        return <AuthPageShell line={BAD_INVITE_LINE} />
    }

    const inviteLine = `${invite.inviterName} invited you to the team ${invite.teamName} as ${roleWords(invite.role)}.`

    if (!profile) {
        return (
            <>
                <AuthPageShell line={inviteLine}>
                    <button
                        type="button"
                        onClick={() => setShowAuthModal(true)}
                        className={authPrimaryButtonClass}
                    >
                        Log in to join
                    </button>
                </AuthPageShell>
                {authModal}
            </>
        )
    }

    const switchAccount = (
        <div className="mt-4 flex justify-center font-sans text-xs text-[#888888]">
            <button
                type="button"
                onClick={() => void handleSwitchAccount()}
                disabled={isJoining}
                className="hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
                Use a different account
            </button>
        </div>
    )

    if (invite.emailMatches === false) {
        return (
            <>
                <AuthPageShell
                    line={
                        <>
                            This invite is for {invite.email}. You are signed in as{' '}
                            <span className="text-white font-medium break-all">
                                {profile.email}
                            </span>
                            .
                        </>
                    }
                >
                    {switchAccount}
                </AuthPageShell>
                {authModal}
            </>
        )
    }

    return (
        <>
            <AuthPageShell line={inviteLine}>
                <div className="flex flex-col gap-2.5">
                    {errorMessage && (
                        <p role="alert" className="font-sans text-xs text-red-400 px-1 text-center">
                            {errorMessage}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => void join()}
                        disabled={isJoining}
                        className={authPrimaryButtonClass}
                    >
                        {isJoining ? 'Joining...' : 'Join'}
                    </button>
                </div>
                {switchAccount}
            </AuthPageShell>
            {authModal}
        </>
    )
}
