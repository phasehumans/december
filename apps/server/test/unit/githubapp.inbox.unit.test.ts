import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { githubAppRepository } from '../../src/modules/githubapp/githubapp.repository'
import { githubAppService } from '../../src/modules/githubapp/githubapp.service'
import { toGithubActivity, toInboxPreview } from '../../src/modules/githubapp/githubapp.utils'
import { notificationService } from '../../src/modules/notification/notification.service'

const repository = { owner: { login: 'phasehumans' }, name: 'december' }
const installation = { id: 77 }

describe('GitHubApp inbox notifications - Unit Tests', () => {
    const originals = {
        findSessionByPullRequest: githubAppRepository.findSessionByPullRequest,
        findByInstallationId: githubAppRepository.findByInstallationId,
        findUserGithubUsername: githubAppRepository.findUserGithubUsername,
        hasUnreadNotification: githubAppRepository.hasUnreadNotification,
        sendNotificationToUser: notificationService.sendNotificationToUser,
    }
    let sent: any[] = []
    let sessionOwner: string | null = 'user-session'

    beforeEach(() => {
        sent = []
        sessionOwner = 'user-session'
        githubAppRepository.findSessionByPullRequest = (async () =>
            sessionOwner ? { userId: sessionOwner } : null) as any
        githubAppRepository.findByInstallationId = (async () => ({
            userId: 'user-install',
        })) as any
        githubAppRepository.findUserGithubUsername = (async () => 'owner-login') as any
        githubAppRepository.hasUnreadNotification = (async () => false) as any
        notificationService.sendNotificationToUser = (async (data: any) => {
            sent.push(data)
            return { id: 'n1', ...data }
        }) as any
    })

    afterEach(() => {
        Object.assign(githubAppRepository, {
            findSessionByPullRequest: originals.findSessionByPullRequest,
            findByInstallationId: originals.findByInstallationId,
            findUserGithubUsername: originals.findUserGithubUsername,
            hasUnreadNotification: originals.hasUnreadNotification,
        })
        notificationService.sendNotificationToUser = originals.sendNotificationToUser
    })

    describe('toGithubActivity', () => {
        it('maps a PR comment', () => {
            const activity = toGithubActivity('issue_comment', {
                action: 'created',
                repository,
                installation,
                issue: { number: 482, pull_request: {}, user: { login: 'trydecember[bot]' } },
                comment: { body: 'looks off', user: { login: 'maya-k', type: 'User' } },
            })
            expect(activity?.number).toBe(482)
            expect(activity?.installationId).toBe('77')
            expect(activity?.activity).toMatchObject({ kind: 'comment', isPullRequest: true })
            // this payload has no repository id: none is made up
            expect(activity).not.toHaveProperty('repoId')
        })

        it('carries the repository id, so a renamed repository still finds its session', () => {
            const activity = toGithubActivity('pull_request_review', {
                action: 'submitted',
                repository: { ...repository, id: 123456 },
                installation,
                pull_request: { number: 9, user: { login: 'trydecember[bot]' } },
                review: { state: 'approved', body: '', user: { login: 'maya-k', type: 'User' } },
            })
            expect(activity?.repoId).toBe('123456')
            expect(activity?.activity).toMatchObject({ kind: 'review', state: 'approved' })
        })

        it('maps only failed check suites with a pull request', () => {
            const base = { action: 'completed', repository, installation }
            expect(
                toGithubActivity('check_suite', {
                    ...base,
                    check_suite: { conclusion: 'success', pull_requests: [{ number: 1 }] },
                })
            ).toBeNull()
            expect(
                toGithubActivity('check_suite', {
                    ...base,
                    check_suite: { conclusion: 'failure', pull_requests: [] },
                })
            ).toBeNull()
            expect(
                toGithubActivity('check_suite', {
                    ...base,
                    check_suite: { conclusion: 'failure', pull_requests: [{ number: 9 }] },
                })?.activity
            ).toEqual({ kind: 'checks_failed' })
        })

        it('ignores events that never notify', () => {
            expect(toGithubActivity('push', { repository })).toBeNull()
            expect(
                toGithubActivity('pull_request_review', {
                    action: 'dismissed',
                    repository,
                    pull_request: { number: 3 },
                })
            ).toBeNull()
        })
    })

    describe('notifyGithubActivity', () => {
        const base = {
            installationId: '77',
            repoOwner: 'phasehumans',
            repoName: 'december',
            number: 482,
        }

        it('sends a mention to the installation owner when someone writes @trydecember', async () => {
            const res = await githubAppService.notifyGithubActivity({
                ...base,
                actorLogin: 'devon',
                activity: {
                    kind: 'comment',
                    isPullRequest: false,
                    body: '@trydecember add a test',
                },
            })
            expect(res.notified).toBe(true)
            expect(sent[0]).toMatchObject({
                userId: 'user-install',
                title: 'devon mentioned December on #482',
                category: 'MENTION',
                toast: true,
            })
        })

        it("sends a review comment on December's PR to the session owner", async () => {
            await githubAppService.notifyGithubActivity({
                ...base,
                actorLogin: 'maya-k',
                activity: { kind: 'review_comment', body: 'keep the old retry count' },
            })
            expect(sent[0]).toMatchObject({
                userId: 'user-session',
                title: 'maya-k commented on #482',
                category: 'MENTION',
                toast: true,
            })
        })

        it('keeps approvals out of Mentions and without a toast', async () => {
            await githubAppService.notifyGithubActivity({
                ...base,
                actorLogin: 'maya-k',
                activity: { kind: 'review', state: 'approved', body: '' },
            })
            expect(sent[0]).toMatchObject({ category: 'GENERAL', toast: false })
            expect(sent[0].title).toBe('maya-k approved #482')
        })

        it('skips bots, empty commented reviews and your own comments', async () => {
            const bot = await githubAppService.notifyGithubActivity({
                ...base,
                actorLogin: 'trydecember[bot]',
                activity: { kind: 'comment', isPullRequest: true, body: 'opened PR' },
            })
            const empty = await githubAppService.notifyGithubActivity({
                ...base,
                actorLogin: 'maya-k',
                activity: { kind: 'review', state: 'commented', body: '  ' },
            })
            const own = await githubAppService.notifyGithubActivity({
                ...base,
                actorLogin: 'Owner-Login',
                activity: { kind: 'comment', isPullRequest: true, body: 'note to self' },
            })
            expect([bot.reason, empty.reason, own.reason]).toEqual([
                'bot',
                'empty_review',
                'own_comment',
            ])
            expect(sent).toHaveLength(0)
        })

        it('ignores comments on pull requests December did not open', async () => {
            sessionOwner = null
            const res = await githubAppService.notifyGithubActivity({
                ...base,
                actorLogin: 'maya-k',
                prAuthorLogin: 'someone-else',
                activity: { kind: 'comment', isPullRequest: true, body: 'hi' },
            })
            expect(res.reason).toBe('not_december_pull_request')
            expect(sent).toHaveLength(0)
        })

        it('finds the owner through the installation for PRs the bot opened from an issue', async () => {
            sessionOwner = null
            await githubAppService.notifyGithubActivity({
                ...base,
                actorLogin: 'maya-k',
                prAuthorLogin: 'trydecember[bot]',
                activity: { kind: 'comment', isPullRequest: true, body: 'thanks' },
            })
            expect(sent[0].userId).toBe('user-install')
        })

        it('sends one failed-checks notice while an earlier one is unread', async () => {
            await githubAppService.notifyGithubActivity({
                ...base,
                activity: { kind: 'checks_failed' },
            })
            githubAppRepository.hasUnreadNotification = (async () => true) as any
            const second = await githubAppService.notifyGithubActivity({
                ...base,
                activity: { kind: 'checks_failed' },
            })
            expect(sent).toHaveLength(1)
            expect(sent[0]).toMatchObject({ title: 'Checks failed on #482', toast: false })
            expect(second.reason).toBe('duplicate')
        })
    })

    describe('toInboxPreview', () => {
        it('collapses whitespace and trims long bodies', () => {
            expect(toInboxPreview('a\n\n  b')).toBe('a b')
            expect(toInboxPreview('x'.repeat(400))).toHaveLength(280)
        })
    })
})
