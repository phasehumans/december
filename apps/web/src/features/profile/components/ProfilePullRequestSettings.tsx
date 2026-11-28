import { checkBranchPrefix } from '@december/shared/pull-request-settings'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { PAGE_SUBTITLES } from './settingsStyles'
import { SettingsInput, SettingsPage, SettingsRow, SettingsSection } from './SettingsUi'

import { ChoiceGroup, Switch } from '@/features/connections/components/ConnectionsUi'
import { profileAPI, type PullRequestSettings } from '@/features/profile/api/profile'

const pick = <T extends string>(...pairs: [T, string][]) =>
    pairs.map(([value, label]) => ({ value, label }))

const OPEN_AS = pick(['draft', 'Draft'], ['ready', 'Ready'])
const AUTHOR = pick(['december', 'December'], ['user', 'You'])
const COMMIT_AUTHOR = pick(['both', 'You and December'], ['december', 'December'])
const REPLIES = pick(['all', 'All'], ['mention', 'Only @trydecember'], ['off', 'Off'])
const REVIEW = pick(['asked', 'When asked'], ['mine', 'My PRs'], ['all', 'All'])

// the same rule as the server: <prefix><session id> must be a branch name git allows
const PREFIX_MAX_LENGTH = 40
const PREFIX_ERROR = 'Git does not allow this branch name'

const errorText = (error: unknown) =>
    error instanceof Error && error.message ? error.message : 'Could not save'

export const PULL_REQUEST_SETTINGS_KEY = ['pull-request-settings'] as const

/**
 * Pull requests (N7-A): the GitHub App switch, how December opens a pull request (#637), and
 * how it answers comments and what it reviews (#568). "Open a pull request" is in the
 * prompt box ("Set as default"); a session is always archived when its pull request merges.
 */
export const ProfilePullRequestSettings: React.FC = () => {
    const queryClient = useQueryClient()

    const settingsQuery = useQuery({
        queryKey: PULL_REQUEST_SETTINGS_KEY,
        queryFn: profileAPI.getPullRequestSettings,
    })

    const save = useMutation({
        mutationFn: (patch: Partial<PullRequestSettings>) =>
            profileAPI.updatePullRequestSettings(patch),
        onMutate: async (patch) => {
            await queryClient.cancelQueries({ queryKey: PULL_REQUEST_SETTINGS_KEY })
            const previous =
                queryClient.getQueryData<PullRequestSettings>(PULL_REQUEST_SETTINGS_KEY)
            if (previous) {
                queryClient.setQueryData(PULL_REQUEST_SETTINGS_KEY, { ...previous, ...patch })
            }
            return { previous }
        },
        onError: (_error, _patch, context) => {
            if (context?.previous) {
                queryClient.setQueryData(PULL_REQUEST_SETTINGS_KEY, context.previous)
            }
        },
        onSuccess: (saved) => {
            queryClient.setQueryData(PULL_REQUEST_SETTINGS_KEY, saved)
        },
        // a failed save rolls back to the values before it, which can hide a newer save
        // that finished first: the saved values come back from the server
        onSettled: (_saved, error) => {
            if (error) void queryClient.invalidateQueries({ queryKey: PULL_REQUEST_SETTINGS_KEY })
        },
    })
    // a save that failed shows its error under the row it came from
    const failedPatch = save.isError ? save.variables : undefined
    const errorFor = (key: keyof PullRequestSettings) =>
        failedPatch && key in failedPatch ? errorText(save.error) : undefined

    // the branch prefix is typed here and saved when the field is left
    const savedPrefix = settingsQuery.data?.branchPrefix
    const [prefix, setPrefix] = React.useState(savedPrefix ?? '')
    const [prefixError, setPrefixError] = React.useState<string | null>(null)
    React.useEffect(() => {
        if (savedPrefix !== undefined) setPrefix(savedPrefix)
    }, [savedPrefix])

    const settings = settingsQuery.data
    if (!settings) {
        return (
            <SettingsPage title="Pull requests" subtitle={PAGE_SUBTITLES.pullRequests}>
                {settingsQuery.isError && (
                    <p className="text-[13px] text-[#7B7A79]">Could not load the settings.</p>
                )}
            </SettingsPage>
        )
    }

    const set = (patch: Partial<PullRequestSettings>) => save.mutate(patch)
    // with GitHub comments off, December answers and reviews nothing
    const isPaused = !settings.githubCommentsEnabled

    const commitPrefix = () => {
        const next = prefix.trim()
        if (next === settings.branchPrefix) {
            setPrefixError(null)
            return
        }
        // the text stays, so it can be fixed
        if (
            next.length > PREFIX_MAX_LENGTH ||
            !/^[A-Za-z0-9._/-]*$/.test(next) ||
            !checkBranchPrefix(next).ok
        ) {
            setPrefixError(PREFIX_ERROR)
            return
        }
        setPrefixError(null)
        set({ branchPrefix: next })
    }

    return (
        <SettingsPage title="Pull requests" subtitle={PAGE_SUBTITLES.pullRequests}>
            <SettingsSection title="GitHub" description="What December does from GitHub comments.">
                <SettingsRow
                    label="Work from GitHub comments"
                    hint={
                        errorFor('githubCommentsEnabled') ??
                        (isPaused ? 'Replies, reviews and check fixes are paused' : undefined)
                    }
                >
                    <Switch
                        label="Work from GitHub comments"
                        checked={settings.githubCommentsEnabled}
                        onChange={(value) => set({ githubCommentsEnabled: value })}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Opening" description="How December opens a pull request.">
                <SettingsRow
                    label="Branch name starts with"
                    hint={prefixError ?? errorFor('branchPrefix')}
                >
                    <div
                        onBlur={commitPrefix}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') (event.target as HTMLElement).blur()
                        }}
                    >
                        <SettingsInput
                            label="Branch name starts with"
                            value={prefix}
                            onChange={(value) => {
                                setPrefix(value)
                                setPrefixError(null)
                            }}
                            mono
                        />
                    </div>
                </SettingsRow>
                <SettingsRow label="Open as" hint={errorFor('prDraft')}>
                    <ChoiceGroup
                        label="Open as"
                        options={OPEN_AS}
                        value={settings.prDraft ? 'draft' : 'ready'}
                        onChange={(value) => set({ prDraft: value === 'draft' })}
                    />
                </SettingsRow>
                <SettingsRow label="Author" hint={errorFor('prAuthor')}>
                    <ChoiceGroup
                        label="Author"
                        options={AUTHOR}
                        value={settings.prAuthor}
                        onChange={(value) => set({ prAuthor: value })}
                    />
                </SettingsRow>
                <SettingsRow label="Commit author" hint={errorFor('commitAuthor')}>
                    <ChoiceGroup
                        label="Commit author"
                        options={COMMIT_AUTHOR}
                        value={settings.commitAuthor}
                        onChange={(value) => set({ commitAuthor: value })}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection
                title="Replies"
                description="How December answers comments and failed checks."
            >
                <SettingsRow label="Answer review comments" hint={errorFor('reviewReplies')}>
                    <ChoiceGroup
                        label="Answer review comments"
                        options={REPLIES}
                        value={settings.reviewReplies}
                        disabled={isPaused}
                        onChange={(value) => set({ reviewReplies: value })}
                    />
                </SettingsRow>
                <SettingsRow
                    label="Fix failed checks on December pull requests"
                    hint={errorFor('fixFailedChecks')}
                >
                    <Switch
                        label="Fix failed checks on December pull requests"
                        checked={settings.fixFailedChecks}
                        disabled={isPaused}
                        onChange={(value) => set({ fixFailedChecks: value })}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Review" description="Which pull requests December reviews.">
                <SettingsRow label="Review pull requests" hint={errorFor('autoReview')}>
                    <ChoiceGroup
                        label="Review pull requests"
                        options={REVIEW}
                        value={settings.autoReview}
                        disabled={isPaused}
                        onChange={(value) => set({ autoReview: value })}
                    />
                </SettingsRow>
            </SettingsSection>
        </SettingsPage>
    )
}
