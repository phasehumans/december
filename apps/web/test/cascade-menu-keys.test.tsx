import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterEach, describe, expect, test } from 'bun:test'
import React from 'react'

import { CascadeMenu, type CascadeItem } from '../src/features/home/components/CascadeMenu'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, act } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
})

// the + menu with one row that opens a list beside it, and a prompt box that has the keys
const renderMenu = (picked: string[], closed: { count: number }) => {
    const items: CascadeItem[] = [
        {
            id: 'repos',
            label: 'Repositories',
            side: (
                <>
                    {['alpha', 'beta', 'gamma'].map((name) => (
                        <button key={name} type="button" onClick={() => picked.push(name)}>
                            {name}
                        </button>
                    ))}
                </>
            ),
        },
        { id: 'upload', label: 'Upload attachment', onPick: () => picked.push('upload') },
    ]
    render(
        <div>
            <textarea aria-label="Prompt" />
            <CascadeMenu
                items={items}
                ariaLabel="Add"
                placement="top"
                onClose={() => {
                    closed.count += 1
                }}
            />
        </div>
    )
    const prompt = screen.getByLabelText('Prompt') as HTMLTextAreaElement
    prompt.focus()
    return prompt
}

const press = (key: string) => {
    act(() => {
        fireEvent.keyDown(document.activeElement ?? document.body, { key })
    })
}

describe('CascadeMenu side list keys', () => {
    test('Right arrow opens the side list and moves the keys to its first row', () => {
        renderMenu([], { count: 0 })
        press('ArrowRight')
        expect(document.activeElement?.textContent).toBe('alpha')
    })

    test('Up and Down move between the side rows and wrap', () => {
        renderMenu([], { count: 0 })
        press('ArrowRight')
        press('ArrowDown')
        expect(document.activeElement?.textContent).toBe('beta')
        press('ArrowDown')
        press('ArrowDown')
        expect(document.activeElement?.textContent).toBe('alpha')
        press('ArrowUp')
        expect(document.activeElement?.textContent).toBe('gamma')
    })

    test('Left arrow closes the side list and gives the keys back to the prompt box', () => {
        const prompt = renderMenu([], { count: 0 })
        press('ArrowRight')
        press('ArrowLeft')
        expect(document.activeElement).toBe(prompt)
        expect(screen.queryByText('alpha')).toBe(null)
    })

    test('Esc in the side list closes only the side list', () => {
        const closed = { count: 0 }
        const prompt = renderMenu([], closed)
        press('ArrowRight')
        press('Escape')
        expect(document.activeElement).toBe(prompt)
        expect(closed.count).toBe(0)
        press('Escape')
        expect(closed.count).toBe(1)
    })

    test('the main menu keys still pick a row with no side list', () => {
        const picked: string[] = []
        renderMenu(picked, { count: 0 })
        press('ArrowDown')
        press('Enter')
        expect(picked).toEqual(['upload'])
    })
})
