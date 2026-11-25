import { describe, expect, it } from 'bun:test'

import {
    branchToSave,
    DECEMBER_IDENTITY,
    legacyTaskBranch,
    needsUserIdentity,
    wantsAppToken,
    gitCommitCommand,
    gitIdentityCommand,
    hasWorkToPublish,
    pickCommitAuthor,
    pickPullRequestTokens,
    pickTaskBranch,
    toUserIdentity,
} from '../../src/pr-opening'
import { shellQuote } from '../../src/shell-quote'

// issue 637 section 3: the worker honors the pull request "opening" settings
describe('pull request opening settings (#637)', () => {
    describe('the task branch', () => {
        it('starts with the prefix of the user', () => {
            expect(pickTaskBranch({ sessionId: 's1', branchPrefix: 'december/' })).toBe(
                'december/s1'
            )
            expect(pickTaskBranch({ sessionId: 's1', branchPrefix: 'feat/ai-' })).toBe('feat/ai-s1')
            expect(pickTaskBranch({ sessionId: 's1', branchPrefix: '' })).toBe('s1')
        })

        it('keeps the saved branch after the user changes the prefix', () => {
            expect(
                pickTaskBranch({
                    sessionId: 's1',
                    branchPrefix: 'feat/',
                    savedBranch: 'december/s1',
                })
            ).toBe('december/s1')
        })

        it('keeps the branch of a session from before the setting (nothing saved)', () => {
            expect(
                pickTaskBranch({
                    sessionId: 's1',
                    branchPrefix: 'feat/',
                    currentBranch: 'december/s1',
                })
            ).toBe('december/s1')
        })

        it('never takes another checked out branch as the task branch', () => {
            expect(
                pickTaskBranch({ sessionId: 's1', branchPrefix: 'feat/', currentBranch: 'main' })
            ).toBe('feat/s1')
        })

        // review E2: a bad name must never reach git or the database
        it('falls back to december/<id> when the prefix gives a name git refuses', () => {
            expect(pickTaskBranch({ sessionId: 's1', branchPrefix: 'wip/.' })).toBe('december/s1')
            expect(pickTaskBranch({ sessionId: 's1', branchPrefix: 'a.lock/' })).toBe('december/s1')
        })

        it('repairs a session with a bad saved branch', () => {
            const taskBranch = pickTaskBranch({
                sessionId: 's1',
                branchPrefix: 'feat/',
                savedBranch: 'wip/.s1',
            })
            expect(taskBranch).toBe('feat/s1')
            expect(branchToSave({ savedBranch: 'wip/.s1', taskBranch })).toBe('feat/s1')
        })

        it('saves the branch only when nothing valid is saved', () => {
            expect(branchToSave({ savedBranch: null, taskBranch: 'feat/s1' })).toBe('feat/s1')
            expect(branchToSave({ savedBranch: '', taskBranch: 'feat/s1' })).toBe('feat/s1')
            expect(branchToSave({ savedBranch: 'december/s1', taskBranch: 'december/s1' })).toBe(
                null
            )
            // a name git refuses is never saved
            expect(branchToSave({ savedBranch: null, taskBranch: 'wip/.s1' })).toBe(null)
        })

        it('has one legacy name', () => {
            expect(legacyTaskBranch('s1')).toBe('december/s1')
        })

        it('does not use a saved name that is not safe in a shell command', () => {
            expect(
                pickTaskBranch({
                    sessionId: 's1',
                    branchPrefix: 'feat/',
                    savedBranch: 'x; rm -rf /',
                })
            ).toBe('feat/s1')
        })
    })

    describe('the commit author', () => {
        it('uses the name and email the git host gives for the user', () => {
            expect(
                toUserIdentity({
                    provider: 'GITHUB',
                    id: 583231,
                    login: 'octocat',
                    name: 'The Octocat',
                    email: 'octocat@github.com',
                })
            ).toEqual({ name: 'The Octocat', email: 'octocat@github.com' })
        })

        it('uses the no-reply address when the email is not known', () => {
            expect(
                toUserIdentity({ provider: 'GITHUB', id: 583231, login: 'octocat', name: null })
            ).toEqual({ name: 'octocat', email: '583231+octocat@users.noreply.github.com' })
            expect(toUserIdentity({ provider: 'GITHUB', login: 'octocat' })).toEqual({
                name: 'octocat',
                email: 'octocat@users.noreply.github.com',
            })
            expect(
                toUserIdentity({ provider: 'GITLAB', id: '42', login: 'jdoe', name: 'J Doe' })
            ).toEqual({ name: 'J Doe', email: '42-jdoe@users.noreply.gitlab.com' })
        })

        it('has no user identity when the host account is not known', () => {
            expect(toUserIdentity({ provider: 'GITHUB' })).toBeNull()
            expect(toUserIdentity({ provider: 'GITLAB', login: 'jdoe' })).toBeNull()
        })

        it('"december" is December only, "both" is the user with December as co-author', () => {
            const user = { name: 'The Octocat', email: 'octocat@github.com' }
            expect(pickCommitAuthor({ commitAuthor: 'december', user })).toEqual({
                author: { name: 'December Agent', email: 'agent@trydecember.com' },
                coAuthor: null,
            })
            expect(pickCommitAuthor({ commitAuthor: 'both', user })).toEqual({
                author: user,
                coAuthor: { name: 'December Agent', email: 'agent@trydecember.com' },
            })
            // the user is not known: December alone, as before
            expect(pickCommitAuthor({ commitAuthor: 'both', user: null })).toEqual({
                author: { name: 'December Agent', email: 'agent@trydecember.com' },
                coAuthor: null,
            })
        })

        it('writes the git identity command, safe for names with quotes', () => {
            expect(gitIdentityCommand(DECEMBER_IDENTITY)).toBe(
                `git config user.name 'December Agent' && git config user.email 'agent@trydecember.com'`
            )
            expect(
                gitIdentityCommand({ name: `Dara O'Brien $(id)`, email: 'dara@example.com' }, true)
            ).toBe(
                `git config --global user.name 'Dara O'\\''Brien $(id)' && git config --global user.email 'dara@example.com'`
            )
        })

        it('adds December as Co-authored-by to the commit', () => {
            expect(gitCommitCommand({ subject: 'feat: add search', coAuthor: null })).toBe(
                `git add -A && git commit -m 'feat: add search'`
            )
            expect(
                gitCommitCommand({ subject: 'feat: add search', coAuthor: DECEMBER_IDENTITY })
            ).toBe(
                `git add -A && git commit -m 'feat: add search' -m 'Co-authored-by: December Agent <agent@trydecember.com>'`
            )
        })
    })

    describe('who opens the pull request', () => {
        it('"user" opens it with the token of the user', () => {
            expect(
                pickPullRequestTokens({
                    prAuthor: 'user',
                    provider: 'GITHUB',
                    userToken: 'user-token',
                    appToken: 'app-token',
                })
            ).toEqual(['user-token'])
        })

        it('"december" opens it as the github app, with the user as the fallback', () => {
            expect(
                pickPullRequestTokens({
                    prAuthor: 'december',
                    provider: 'GITHUB',
                    userToken: 'user-token',
                    appToken: 'app-token',
                })
            ).toEqual(['app-token', 'user-token'])
        })

        it('"december" falls back to the user when the app is not on the repository', () => {
            expect(
                pickPullRequestTokens({
                    prAuthor: 'december',
                    provider: 'GITHUB',
                    userToken: 'user-token',
                    appToken: null,
                })
            ).toEqual(['user-token'])
        })

        it('gitlab always uses the token of the user', () => {
            expect(
                pickPullRequestTokens({
                    prAuthor: 'december',
                    provider: 'GITLAB',
                    userToken: 'user-token',
                    appToken: 'app-token',
                })
            ).toEqual(['user-token'])
        })
    })

    // a run ends: is there work to commit, push and open a pull request for
    describe('work to publish', () => {
        it('is there when the tree has changed or new files', () => {
            expect(hasWorkToPublish({ statusOutput: ' M src/a.ts', aheadCount: '0' })).toBe(true)
            expect(hasWorkToPublish({ statusOutput: '?? b.ts', aheadCount: null })).toBe(true)
        })

        it('is there when the tree is clean but the agent made commits no remote has', () => {
            expect(hasWorkToPublish({ statusOutput: '', aheadCount: '2\n' })).toBe(true)
        })

        it('is not there when the tree is clean and no commit is ahead', () => {
            expect(hasWorkToPublish({ statusOutput: '', aheadCount: '0\n' })).toBe(false)
            expect(hasWorkToPublish({ statusOutput: '  \n', aheadCount: '0' })).toBe(false)
        })

        it('is not there when the tree is clean and the count is not known', () => {
            expect(hasWorkToPublish({ statusOutput: '', aheadCount: null })).toBe(false)
            expect(hasWorkToPublish({ statusOutput: '', aheadCount: '' })).toBe(false)
            expect(hasWorkToPublish({ statusOutput: '', aheadCount: 'fatal: bad revision' })).toBe(
                false
            )
        })
    })
})

// review D8: each opening rule lives once
describe('the opening rules in one place', () => {
    it('the user is looked up only when the commit author is "both"', () => {
        expect(needsUserIdentity('both')).toBe(true)
        expect(needsUserIdentity('december')).toBe(false)
    })

    it('the app token is wanted only for "december" on GitHub', () => {
        expect(wantsAppToken({ prAuthor: 'december', provider: 'GITHUB' })).toBe(true)
        expect(wantsAppToken({ prAuthor: 'user', provider: 'GITHUB' })).toBe(false)
        expect(wantsAppToken({ prAuthor: 'december', provider: 'GITLAB' })).toBe(false)
    })
})

describe('shellQuote', () => {
    it('keeps every character as one shell argument', () => {
        expect(shellQuote('a b')).toBe(`'a b'`)
        expect(shellQuote(`it's`)).toBe(`'it'\\''s'`)
        expect(shellQuote('$(rm -rf /)')).toBe(`'$(rm -rf /)'`)
    })
})
