import { describe, it, expect } from 'bun:test'

import {
    splitRepoFilter,
    toSessionFacets,
    toTagsCacheKey,
} from '../../src/modules/session/session.utils'

// issue 641: the pure parts of the sessions list filters
describe('sessions list filters (#641)', () => {
    describe('toTagsCacheKey', () => {
        it('is one fixed part when no tag is asked', () => {
            expect(toTagsCacheKey(undefined)).toBe('any-tag')
            expect(toTagsCacheKey([])).toBe('any-tag')
        })

        it('is the same for the same tags in any order', () => {
            expect(toTagsCacheKey(['copy', 'bug'])).toBe('tags=bug,copy')
            expect(toTagsCacheKey(['bug', 'copy', 'bug'])).toBe('tags=bug,copy')
        })

        it('keeps a tag with a colon or a comma apart from the other key parts', () => {
            expect(toTagsCacheKey(['a:b'])).toBe('tags=a%3Ab')
            expect(toTagsCacheKey(['a,b'])).not.toBe(toTagsCacheKey(['a', 'b']))
        })
    })

    describe('splitRepoFilter', () => {
        it('reads a short name as the name alone', () => {
            expect(splitRepoFilter('web')).toEqual({ owner: null, name: 'web' })
        })

        it('reads owner/name as the owner and the name', () => {
            expect(splitRepoFilter('acme/web')).toEqual({ owner: 'acme', name: 'web' })
        })

        it('keeps a gitlab group path as the owner', () => {
            expect(splitRepoFilter('acme/tools/importer')).toEqual({
                owner: 'acme/tools',
                name: 'importer',
            })
        })

        it('drops slashes at the ends', () => {
            expect(splitRepoFilter('/acme/web/')).toEqual({ owner: 'acme', name: 'web' })
            expect(splitRepoFilter('web/')).toEqual({ owner: null, name: 'web' })
        })
    })

    describe('toSessionFacets', () => {
        const repo = (
            githubRepoOwner: string | null,
            githubRepoName: string | null,
            sessions = 1,
            repoUrl: string | null = null
        ) => ({ githubRepoOwner, githubRepoName, repoUrl, sessions })

        it('names a repository owner/name, or the name alone when the owner is not known', () => {
            expect(
                toSessionFacets({ repos: [repo('acme', 'web'), repo(null, 'solo')], tags: [] })
            ).toEqual({ repos: ['acme/web', 'solo'], tags: [] })
        })

        it('sorts both lists by name, capital letters mixed in', () => {
            expect(
                toSessionFacets({
                    repos: [repo('zed', 'app'), repo('Beta', 'web'), repo('acme', 'web')],
                    tags: ['copy', 'Api', 'bug'],
                })
            ).toEqual({
                repos: ['acme/web', 'Beta/web', 'zed/app'],
                tags: ['Api', 'bug', 'copy'],
            })
        })

        it('keeps one spelling of a repository: the one on the most sessions', () => {
            expect(
                toSessionFacets({
                    repos: [repo('Acme', 'Web', 1), repo('acme', 'web', 4), repo('ACME', 'WEB', 2)],
                    tags: [],
                }).repos
            ).toEqual(['acme/web'])
        })

        it('reads the repository of an old row from its link', () => {
            expect(
                toSessionFacets({
                    repos: [
                        repo(null, null, 1, 'https://github.com/acme/legacy.git'),
                        repo(null, null, 1, 'https://gitlab.com/acme/tools/importer'),
                        repo(null, null, 1, 'https://example.com/not/a/known/host'),
                        repo(null, null, 1, null),
                    ],
                    tags: [],
                }).repos
            ).toEqual(['acme/legacy', 'acme/tools/importer'])
        })

        it('leaves out empty tags and lists a tag once', () => {
            expect(toSessionFacets({ repos: [], tags: ['bug', '', 'bug', ' '] }).tags).toEqual([
                'bug',
            ])
        })
    })
})
