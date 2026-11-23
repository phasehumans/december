import { describe, expect, test } from 'bun:test'

import { menuButtonBadge } from './mobileBadge'

describe('menuButtonBadge', () => {
    test('unread shows on the menu button when there is no inbox bell', () => {
        expect(menuButtonBadge({ hasInboxButton: false, unread: true, running: false })).toBe(
            'unread'
        )
    })

    test('unread wins over running', () => {
        expect(menuButtonBadge({ hasInboxButton: false, unread: true, running: true })).toBe(
            'unread'
        )
    })

    test('on home the bell carries unread, the menu only shows running', () => {
        expect(menuButtonBadge({ hasInboxButton: true, unread: true, running: false })).toBe(null)
        expect(menuButtonBadge({ hasInboxButton: true, unread: true, running: true })).toBe(
            'running'
        )
    })

    test('nothing to show', () => {
        expect(menuButtonBadge({ hasInboxButton: false, unread: false, running: false })).toBe(null)
    })
})
