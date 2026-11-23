import React from 'react'

import { PAGE_SUBTITLES } from './settingsStyles'
import {
    SettingsInput,
    SettingsPage,
    SettingsRow,
    SettingsSection,
    SettingsSelect,
    SettingsSoon,
    usePreviewOn,
    usePreviewValue,
} from './SettingsUi'

import { ChoiceGroup, Switch } from '@/features/connections/components/ConnectionsUi'

const pick = <T extends string>(...pairs: [T, string][]) =>
    pairs.map(([value, label]) => ({ value, label }))

const OPEN_AS = pick(['draft', 'Draft'], ['ready', 'Ready'])
const CREATE = pick(['auto', 'When the work is done'], ['ask', 'When I ask'])
const AUTHOR = pick(['december', 'December'], ['user', 'You'])
const COMMIT_AUTHOR = pick(['both', 'You and December'], ['december', 'December'])
const REPLIES = pick(['all', 'All'], ['mention', 'Only @december'], ['off', 'Off'])
const REVIEW = pick(['off', 'Off'], ['mine', 'Mine'], ['all', 'All'])
const CADENCE = pick(['once', 'Once'], ['push', 'On every push'])
const REVIEW_REPOS = ['All connected', 'acme/web', 'acme/api'] as const

/**
 * Pull requests (N7-A): how December opens a pull request, how it replies, and what it
 * reviews. One page, three sections. Ui only until the server part exists (issue 637).
 */
export const ProfilePullRequestSettings: React.FC = () => {
    const isPreview = usePreviewOn()
    const [prefix, setPrefix] = usePreviewValue('pr.prefix', 'december/')
    const [openAs, setOpenAs] = usePreviewValue<'draft' | 'ready'>('pr.openAs', 'draft')
    const [create, setCreate] = usePreviewValue<'auto' | 'ask'>('pr.create', 'auto')
    const [author, setAuthor] = usePreviewValue<'december' | 'user'>('pr.author', 'december')
    const [commitAuthor, setCommitAuthor] = usePreviewValue<'both' | 'december'>(
        'pr.commitAuthor',
        'both'
    )
    const [archive, setArchive] = usePreviewValue('pr.archiveOnMerge', true)
    const [replies, setReplies] = usePreviewValue<'all' | 'mention' | 'off'>(
        'pr.replies',
        'mention'
    )
    const [bots, setBots] = usePreviewValue('pr.bots', false)
    const [fixChecks, setFixChecks] = usePreviewValue('pr.fixChecks', true)
    const [review, setReview] = usePreviewValue<'off' | 'mine' | 'all'>('pr.review', 'off')
    const [cadence, setCadence] = usePreviewValue<'once' | 'push'>('pr.cadence', 'once')
    const [reviewRepos, setReviewRepos] = usePreviewValue<string>('pr.reviewRepos', REVIEW_REPOS[0])

    if (!isPreview) {
        return (
            <SettingsSoon
                title="Pull requests"
                subtitle={PAGE_SUBTITLES.pullRequests}
                text="Pull request settings are coming soon"
            />
        )
    }

    return (
        <SettingsPage title="Pull requests" subtitle={PAGE_SUBTITLES.pullRequests}>
            <SettingsSection title="Opening" description="How December opens a pull request.">
                <SettingsRow label="Branch name starts with">
                    <SettingsInput
                        label="Branch name starts with"
                        value={prefix}
                        onChange={setPrefix}
                        mono
                    />
                </SettingsRow>
                <SettingsRow label="Open as">
                    <ChoiceGroup
                        label="Open as"
                        options={OPEN_AS}
                        value={openAs}
                        onChange={setOpenAs}
                    />
                </SettingsRow>
                <SettingsRow label="Create the pull request">
                    <ChoiceGroup
                        label="Create the pull request"
                        options={CREATE}
                        value={create}
                        onChange={setCreate}
                    />
                </SettingsRow>
                <SettingsRow label="Author">
                    <ChoiceGroup
                        label="Author"
                        options={AUTHOR}
                        value={author}
                        onChange={setAuthor}
                    />
                </SettingsRow>
                <SettingsRow label="Commit author">
                    <ChoiceGroup
                        label="Commit author"
                        options={COMMIT_AUTHOR}
                        value={commitAuthor}
                        onChange={setCommitAuthor}
                    />
                </SettingsRow>
                <SettingsRow label="Archive the session when the pull request merges">
                    <Switch
                        label="Archive the session when the pull request merges"
                        checked={archive}
                        onChange={setArchive}
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
                        value={replies}
                        onChange={setReplies}
                    />
                </SettingsRow>
                <SettingsRow label="Answer comments from bots">
                    <Switch label="Answer comments from bots" checked={bots} onChange={setBots} />
                </SettingsRow>
                <SettingsRow label="Fix failed checks on December pull requests">
                    <Switch
                        label="Fix failed checks on December pull requests"
                        checked={fixChecks}
                        onChange={setFixChecks}
                    />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Review" description="Which pull requests December reviews.">
                <SettingsRow label="Review pull requests">
                    <ChoiceGroup
                        label="Review pull requests"
                        options={REVIEW}
                        value={review}
                        onChange={setReview}
                    />
                </SettingsRow>
                <SettingsRow label="Review again">
                    <ChoiceGroup
                        label="Review again"
                        options={CADENCE}
                        value={cadence}
                        onChange={setCadence}
                    />
                </SettingsRow>
                <SettingsRow label="Repositories">
                    <SettingsSelect
                        label="Repositories to review"
                        value={reviewRepos}
                        options={REVIEW_REPOS}
                        onChange={setReviewRepos}
                    />
                </SettingsRow>
            </SettingsSection>
        </SettingsPage>
    )
}
