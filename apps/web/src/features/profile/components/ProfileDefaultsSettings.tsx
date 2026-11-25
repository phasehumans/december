import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { ModelSourceControl } from './ModelSourceControl'
import { PAGE_SUBTITLES } from './settingsStyles'
import {
    SettingsInput,
    SettingsPage,
    SettingsRow,
    SettingsSection,
    SettingsSelect,
    usePreviewOn,
    usePreviewValue,
} from './SettingsUi'

import { ChoiceGroup, DemoPill, Switch } from '@/features/connections/components/ConnectionsUi'
import { profileAPI, type Profile, type SessionDefaults } from '@/features/profile/api/profile'
import { useByokList } from '@/features/profile/hooks/useByokData'
import { useConnectedRepos } from '@/features/profile/hooks/useConnectedRepos'

// sample choices for the model of each step (N25). there is no server part for it yet
const STEP_MODELS = [
    'Same as Model',
    'Gemini 2.5 Pro',
    'Gemini 2.5 Flash',
    'Claude Sonnet',
    'Claude Opus',
] as const

type Speed = 'fast' | 'deep'
const SPEEDS: { value: Speed; label: string }[] = [
    { value: 'fast', label: 'Fast' },
    { value: 'deep', label: 'Deep' },
]

const PROFILE_KEY = ['profile'] as const
const LAST_USED = 'last-used'
const DEFAULT_BRANCH = 'default'
const KEY_DEFAULT = ''
// the same names the server takes
const BRANCH_NAME = /^[\w./-]{1,100}$/

/**
 * Defaults (N2-B): what a new session starts with. Every row is saved on the account and
 * the prompt box starts from these values. The model for each step (N25) is ui only: it
 * shows with the preview on.
 */
export const ProfileDefaultsSettings: React.FC = () => {
    const isPreview = usePreviewOn()
    const queryClient = useQueryClient()

    const profileQuery = useQuery({ queryKey: PROFILE_KEY, queryFn: profileAPI.getProfile })
    const profile = profileQuery.data
    const { data: byok } = useByokList(true)
    const { repos } = useConnectedRepos({
        enabled: Boolean(profile),
        isGithubConnected: Boolean(profile?.githubAppInstall || profile?.githubConnected),
    })

    const save = useMutation({
        mutationFn: (patch: Partial<SessionDefaults>) => profileAPI.updateSessionDefaults(patch),
        onMutate: async (patch) => {
            await queryClient.cancelQueries({ queryKey: PROFILE_KEY })
            const previous = queryClient.getQueryData<Profile>(PROFILE_KEY)
            if (previous) queryClient.setQueryData(PROFILE_KEY, { ...previous, ...patch })
            return { previous }
        },
        onError: (_error, _patch, context) => {
            if (context?.previous) queryClient.setQueryData(PROFILE_KEY, context.previous)
        },
        onSuccess: (saved) => {
            const current = queryClient.getQueryData<Profile>(PROFILE_KEY)
            if (current) queryClient.setQueryData(PROFILE_KEY, { ...current, ...saved })
        },
    })
    const set = (patch: Partial<SessionDefaults>) => save.mutate(patch)

    // the base branch is typed: null shows the saved name, a string is the text being typed
    const [branchDraft, setBranchDraft] = React.useState<string | null>(null)

    // the model for each step (#637 section 2): sample values in memory, preview only
    const [planModel, setPlanModel] = usePreviewValue<string>('defaults.step.plan', STEP_MODELS[0])
    const [buildModel, setBuildModel] = usePreviewValue<string>(
        'defaults.step.build',
        STEP_MODELS[0]
    )
    const [reviewModel, setReviewModel] = usePreviewValue<string>(
        'defaults.step.review',
        'Claude Sonnet'
    )

    if (!profile) {
        return (
            <SettingsPage title="Defaults" subtitle={PAGE_SUBTITLES.defaults}>
                {profileQuery.isError && (
                    <p className="text-[13px] text-[#7B7A79]">Could not load the settings.</p>
                )}
            </SettingsPage>
        )
    }

    // the models of the saved keys. with more than one key the provider is in the label
    const credentials = byok?.credentials ?? []
    const keyModels = credentials.flatMap((credential) => {
        const providerName =
            byok?.providers.find((p) => p.id === credential.provider)?.name ?? credential.provider
        return credential.models.map((model) => ({
            value: `${credential.provider}:${model}`,
            label: credentials.length > 1 ? `${providerName}: ${model}` : model,
            provider: credential.provider,
            model,
        }))
    })
    // a default on a key that was removed shows as "Default of the key"
    const savedKeyModel =
        keyModels.find(
            (option) =>
                option.provider === profile.defaultOwnKeyProvider &&
                option.model === profile.defaultOwnKeyModel
        )?.value ?? KEY_DEFAULT
    const setKeyModel = (value: string) => {
        const picked = keyModels.find((option) => option.value === value)
        set({
            defaultOwnKeyProvider: picked?.provider ?? null,
            defaultOwnKeyModel: picked?.model ?? null,
        })
    }

    const savedRepository = profile.defaultRepository ?? LAST_USED
    const repositoryOptions = [
        { value: LAST_USED, label: 'Last used' },
        ...repos.map((repo) => ({ value: repo.fullName, label: repo.fullName })),
    ]
    // a saved repository that is not in the list (yet) still shows
    if (!repositoryOptions.some((option) => option.value === savedRepository)) {
        repositoryOptions.push({ value: savedRepository, label: savedRepository })
    }

    const savedBranch =
        profile.defaultBaseBranch && profile.defaultBaseBranch !== DEFAULT_BRANCH
            ? profile.defaultBaseBranch
            : ''
    const commitBranch = () => {
        if (branchDraft === null) return
        const next = branchDraft.trim() || DEFAULT_BRANCH
        setBranchDraft(null)
        // a name git does not allow is not saved: the field goes back to the saved name
        if (!BRANCH_NAME.test(next)) return
        if (next !== (profile.defaultBaseBranch ?? DEFAULT_BRANCH)) {
            set({ defaultBaseBranch: next })
        }
    }

    return (
        <SettingsPage title="Defaults" subtitle={PAGE_SUBTITLES.defaults}>
            <SettingsSection
                title="Model"
                description="The model and speed a new session starts with."
            >
                <SettingsRow label="Model source">
                    <ModelSourceControl />
                </SettingsRow>
                {keyModels.length > 0 && (
                    <SettingsRow label="Model for your keys">
                        <SettingsSelect
                            label="Model for your keys"
                            value={savedKeyModel}
                            options={[
                                { value: KEY_DEFAULT, label: 'Default of the key' },
                                ...keyModels,
                            ]}
                            onChange={setKeyModel}
                            className="w-[220px]"
                        />
                    </SettingsRow>
                )}
                <SettingsRow label="Speed">
                    <ChoiceGroup
                        label="Speed"
                        options={SPEEDS}
                        value={profile.defaultEffort ?? 'deep'}
                        onChange={(value) => set({ defaultEffort: value })}
                    />
                </SettingsRow>
                <SettingsRow label="Plan first">
                    <Switch
                        label="Plan first"
                        checked={profile.defaultPlanFirst ?? false}
                        onChange={(value) => set({ defaultPlanFirst: value })}
                    />
                </SettingsRow>
                <SettingsRow label="Open a pull request">
                    <Switch
                        label="Open a pull request"
                        checked={profile.defaultOpenPullRequest ?? true}
                        onChange={(value) => set({ defaultOpenPullRequest: value })}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Repository" description="Where a new session starts.">
                <SettingsRow label="Repository">
                    <SettingsSelect
                        label="Repository"
                        value={savedRepository}
                        options={repositoryOptions}
                        onChange={(value) => set({ defaultRepository: value })}
                        className="w-[220px]"
                    />
                </SettingsRow>
                <SettingsRow label="Base branch">
                    {/* saved when the field loses focus or on Enter, not on every key */}
                    <div
                        className="max-w-full"
                        onBlur={commitBranch}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') (event.target as HTMLElement).blur()
                        }}
                    >
                        <SettingsInput
                            label="Base branch"
                            value={branchDraft ?? savedBranch}
                            onChange={setBranchDraft}
                            placeholder="Default branch"
                            className="w-[220px]"
                            mono
                        />
                    </div>
                </SettingsRow>
            </SettingsSection>

            {isPreview && (
                <SettingsSection
                    title="Model for each step"
                    description="Use another model to plan, build or review."
                    action={<DemoPill />}
                >
                    <SettingsRow label="Plan">
                        <SettingsSelect
                            label="Model for the plan step"
                            value={planModel}
                            options={STEP_MODELS}
                            onChange={setPlanModel}
                        />
                    </SettingsRow>
                    <SettingsRow label="Build">
                        <SettingsSelect
                            label="Model for the build step"
                            value={buildModel}
                            options={STEP_MODELS}
                            onChange={setBuildModel}
                        />
                    </SettingsRow>
                    <SettingsRow label="Review">
                        <SettingsSelect
                            label="Model for the review step"
                            value={reviewModel}
                            options={STEP_MODELS}
                            onChange={setReviewModel}
                        />
                    </SettingsRow>
                </SettingsSection>
            )}
        </SettingsPage>
    )
}
