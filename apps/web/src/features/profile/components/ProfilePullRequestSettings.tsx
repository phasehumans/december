import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { PAGE_SUBTITLES } from './settingsStyles'
import {
    SettingsInput,
    SettingsPage,
    SettingsRow,
    SettingsSection,
    SettingsSelect,
} from './SettingsUi'

import { ChoiceGroup, Switch } from '@/features/connections/components/ConnectionsUi'
import { profileAPI, type PullRequestSettings } from '@/features/profile/api/profile'

const pick = <T extends string>(...pairs: [T, string][]) =>
    pairs.map(([value, label]) => ({ value, label }))

const OPEN_AS = pick(['draft', 'Draft'], ['ready', 'Ready'])
const CREATE = pick(['auto', 'When the work is done'], ['ask', 'When I ask'])
const AUTHOR = pick(['december', 'December'], ['user', 'You'])
const COMMIT_AUTHOR = pick(['both', 'You and December'], ['december', 'December'])
const REPLIES = pick(['all', 'All'], ['mention', 'Only @trydecember'], ['off', 'Off'])
const REVIEW = pick(['asked', 'When asked'], ['mine', 'My PRs'], ['all', 'All'])
const CADENCE = pick(['once', 'Once'], ['push', 'On every push'])
const ALL_REPOS = '__all__'

export const PULL_REQUEST_SETTINGS_KEY = ['pull-request-settings'] as const

/**
 * Pull requests (N7-A): the GitHub App switch, how December answers comments and what it
 * reviews (#568), and how it opens a pull request (#637).
 */
export const ProfilePullRequestSettings: React.FC = () => {
    const queryClient = useQueryClient()

    const settingsQuery = useQuery({
        queryKey: PULL_REQUEST_SETTINGS_KEY,
        queryFn: profileAPI.getPullRequestSettings,
    })
    const reposQuery = useQuery({
        queryKey: ['github-repos'],
        queryFn: profileAPI.getGithubRepos,
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
        onSuccess: (saved, patch) => {
            queryClient.setQueryData(PULL_REQUEST_SETTINGS_KEY, saved)
            // "create the pull request" is also the "open pull request" default of the
            // prompt box, which reads it from the profile
            if (patch.prCreate !== undefined) {
                void queryClient.invalidateQueries({ queryKey: ['profile'] })
            }
        },
    })

    // the branch prefix is typed here and saved when the field is left
    const savedPrefix = settingsQuery.data?.branchPrefix
    const [prefix, setPrefix] = React.useState(savedPrefix ?? '')
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
    const isAutoReview = settings.autoReview !== 'asked'
    const repoOptions = [
        { value: ALL_REPOS, label: 'All connected' },
        ...(reposQuery.data ?? []).map((repo) => ({
            value: repo.fullName.toLowerCase(),
            label: repo.fullName,
        })),
    ]
    // a saved repository that is not in the list (yet) still shows
    const savedRepo = settings.reviewRepos[0]
    if (savedRepo && !repoOptions.some((o) => o.value === savedRepo)) {
        repoOptions.push({ value: savedRepo, label: savedRepo })
    }

    return (
        <SettingsPage title="Pull requests" subtitle={PAGE_SUBTITLES.pullRequests}>
            <SettingsSection title="GitHub" description="What December does from GitHub comments.">
                <SettingsRow label="Work from GitHub comments">
                    <Switch
                        label="Work from GitHub comments"
                        checked={settings.githubCommentsEnabled}
                        onChange={(value) => set({ githubCommentsEnabled: value })}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Opening" description="How December opens a pull request.">
                <SettingsRow label="Branch name starts with">
                    <div
                        onBlur={() => {
                            const next = prefix.trim()
                            if (next !== settings.branchPrefix) set({ branchPrefix: next })
                        }}
                    >
                        <SettingsInput
                            label="Branch name starts with"
                            value={prefix}
                            onChange={setPrefix}
                            mono
                        />
                    </div>
                </SettingsRow>
                <SettingsRow label="Open as">
                    <ChoiceGroup
                        label="Open as"
                        options={OPEN_AS}
                        value={settings.prDraft ? 'draft' : 'ready'}
                        onChange={(value) => set({ prDraft: value === 'draft' })}
                    />
                </SettingsRow>
                <SettingsRow label="Create the pull request">
                    <ChoiceGroup
                        label="Create the pull request"
                        options={CREATE}
                        value={settings.prCreate}
                        onChange={(value) => set({ prCreate: value })}
                    />
                </SettingsRow>
                <SettingsRow label="Author">
                    <ChoiceGroup
                        label="Author"
                        options={AUTHOR}
                        value={settings.prAuthor}
                        onChange={(value) => set({ prAuthor: value })}
                    />
                </SettingsRow>
                <SettingsRow label="Commit author">
                    <ChoiceGroup
                        label="Commit author"
                        options={COMMIT_AUTHOR}
                        value={settings.commitAuthor}
                        onChange={(value) => set({ commitAuthor: value })}
                    />
                </SettingsRow>
                <SettingsRow label="Archive the session when the pull request merges">
                    <Switch
                        label="Archive the session when the pull request merges"
                        checked={settings.archiveOnMerge}
                        onChange={(value) => set({ archiveOnMerge: value })}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection
                title="Replies"
                description="How December answers comments and failed checks."
            >
                <SettingsRow label="Answer review comments">
                    <ChoiceGroup
                        label="Answer review comments"
                        options={REPLIES}
                        value={settings.reviewReplies}
                        onChange={(value) => set({ reviewReplies: value })}
                    />
                </SettingsRow>
                <SettingsRow label="Answer comments from bots">
                    <Switch
                        label="Answer comments from bots"
                        checked={settings.replyToBots}
                        onChange={(value) => set({ replyToBots: value })}
                    />
                </SettingsRow>
                <SettingsRow label="Fix failed checks on December pull requests">
                    <Switch
                        label="Fix failed checks on December pull requests"
                        checked={settings.fixFailedChecks}
                        onChange={(value) => set({ fixFailedChecks: value })}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Review" description="Which pull requests December reviews.">
                <SettingsRow label="Review pull requests">
                    <ChoiceGroup
                        label="Review pull requests"
                        options={REVIEW}
                        value={settings.autoReview}
                        onChange={(value) => set({ autoReview: value })}
                    />
                </SettingsRow>
                {isAutoReview && (
                    <>
                        <SettingsRow label="Review again">
                            <ChoiceGroup
                                label="Review again"
                                options={CADENCE}
                                value={settings.reviewCadence}
                                onChange={(value) => set({ reviewCadence: value })}
                            />
                        </SettingsRow>
                        <SettingsRow label="Repositories">
                            <SettingsSelect
                                label="Repositories to review"
                                value={savedRepo ?? ALL_REPOS}
                                options={repoOptions}
                                onChange={(value) =>
                                    set({ reviewRepos: value === ALL_REPOS ? [] : [value] })
                                }
                            />
                        </SettingsRow>
                    </>
                )}
            </SettingsSection>
        </SettingsPage>
    )
}
