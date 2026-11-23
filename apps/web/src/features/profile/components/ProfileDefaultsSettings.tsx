import React from 'react'

import { ModelSourceControl } from './ModelSourceControl'
import { PAGE_SUBTITLES } from './settingsStyles'
import {
    SettingsPage,
    SettingsRow,
    SettingsSection,
    SettingsSelect,
    SettingsSoon,
    usePreviewOn,
    usePreviewValue,
} from './SettingsUi'

import { ChoiceGroup, Switch } from '@/features/connections/components/ConnectionsUi'

// sample choices for the ui-only rows. the real lists come with the server part (issue 637)
const MODELS = ['Gemini 2.5 Pro', 'Gemini 2.5 Flash', 'Claude Sonnet', 'Claude Opus'] as const
const STEP_MODELS = ['Same as Model', ...MODELS] as const
const REPOSITORIES = ['Last used', 'acme/web', 'acme/api'] as const
const BRANCHES = ['Default branch', 'main', 'develop'] as const

type Effort = 'fast' | 'deep'
const EFFORTS: { value: Effort; label: string }[] = [
    { value: 'fast', label: 'Fast' },
    { value: 'deep', label: 'Deep' },
]

/**
 * Defaults (N2-B): what a new session starts with. Model source is the real setting, moved
 * here from the Your keys page. The other rows and the model for each step (N25) are ui only.
 */
export const ProfileDefaultsSettings: React.FC = () => {
    const isPreview = usePreviewOn()
    const [model, setModel] = usePreviewValue<string>('defaults.model', MODELS[0])
    const [effort, setEffort] = usePreviewValue<Effort>('defaults.effort', 'fast')
    const [planFirst, setPlanFirst] = usePreviewValue('defaults.planFirst', false)
    const [repository, setRepository] = usePreviewValue<string>('defaults.repo', REPOSITORIES[0])
    const [branch, setBranch] = usePreviewValue<string>('defaults.branch', BRANCHES[0])
    const [planModel, setPlanModel] = usePreviewValue<string>('defaults.step.plan', STEP_MODELS[0])
    const [buildModel, setBuildModel] = usePreviewValue<string>(
        'defaults.step.build',
        STEP_MODELS[0]
    )
    const [reviewModel, setReviewModel] = usePreviewValue<string>(
        'defaults.step.review',
        'Claude Sonnet'
    )

    if (!isPreview) {
        return (
            <SettingsSoon
                title="Defaults"
                subtitle={PAGE_SUBTITLES.defaults}
                text="Defaults for new sessions are coming soon"
            />
        )
    }

    return (
        <SettingsPage title="Defaults" subtitle={PAGE_SUBTITLES.defaults}>
            <SettingsSection
                title="Model"
                description="The model and effort a new session starts with."
            >
                <SettingsRow label="Model source">
                    <ModelSourceControl />
                </SettingsRow>
                <SettingsRow label="Model">
                    <SettingsSelect
                        label="Model"
                        value={model}
                        options={MODELS}
                        onChange={setModel}
                    />
                </SettingsRow>
                <SettingsRow label="Effort">
                    <ChoiceGroup
                        label="Effort"
                        options={EFFORTS}
                        value={effort}
                        onChange={setEffort}
                    />
                </SettingsRow>
                <SettingsRow label="Plan first">
                    <Switch label="Plan first" checked={planFirst} onChange={setPlanFirst} />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Repository" description="Where a new session starts.">
                <SettingsRow label="Repository">
                    <SettingsSelect
                        label="Repository"
                        value={repository}
                        options={REPOSITORIES}
                        onChange={setRepository}
                    />
                </SettingsRow>
                <SettingsRow label="Base branch">
                    <SettingsSelect
                        label="Base branch"
                        value={branch}
                        options={BRANCHES}
                        onChange={setBranch}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection
                title="Model for each step"
                description="Use another model to plan, build or review."
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
        </SettingsPage>
    )
}
