import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent } = await import('@testing-library/react')
const { SettingsSelect, PageSizeSelect } =
    await import('../src/features/profile/components/SettingsUi')

const OPTIONS = [
    { value: '', label: 'Pick a repository' },
    { value: 'acme/api', label: 'acme/api' },
    { value: 'acme/web', label: 'acme/web' },
]

const Harness: React.FC<{ onChange?: (value: string) => void; disabled?: boolean }> = ({
    onChange,
    disabled,
}) => {
    const [value, setValue] = React.useState('')
    return (
        <SettingsSelect
            label="Repository"
            value={value}
            options={OPTIONS}
            disabled={disabled}
            onChange={(next) => {
                setValue(next)
                onChange?.(next)
            }}
        />
    )
}

const trigger = () => screen.getByRole('button', { name: 'Repository' })
const key = (k: string) => fireEvent.keyDown(document, { key: k })

describe('settings: the shared dropdown', () => {
    afterEach(() => cleanup())

    test('shows the picked label and opens a list of options', () => {
        render(<Harness />)
        expect(trigger().textContent).toContain('Pick a repository')
        expect(trigger().getAttribute('aria-expanded')).toBe('false')
        expect(screen.queryByRole('listbox')).toBeNull()

        fireEvent.click(trigger())
        expect(trigger().getAttribute('aria-expanded')).toBe('true')
        const list = screen.getByRole('listbox', { name: 'Repository' })
        // drawn over the page, so a dialog does not cut it
        expect(list.parentElement).toBe(document.body)
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
            'Pick a repository',
            'acme/api',
            'acme/web',
        ])
        expect(
            screen.getByRole('option', { name: 'Pick a repository' }).getAttribute('aria-selected')
        ).toBe('true')
    })

    test('a click on an option picks it and closes the list', () => {
        const onChange = mock(() => {})
        render(<Harness onChange={onChange} />)
        fireEvent.click(trigger())
        fireEvent.click(screen.getByRole('option', { name: 'acme/web' }))
        expect(onChange).toHaveBeenCalledWith('acme/web')
        expect(screen.queryByRole('listbox')).toBeNull()
        expect(trigger().textContent).toContain('acme/web')
    })

    test('picking the same value again does not call onChange', () => {
        const onChange = mock(() => {})
        render(<Harness onChange={onChange} />)
        fireEvent.click(trigger())
        fireEvent.click(screen.getByRole('option', { name: 'Pick a repository' }))
        expect(onChange).not.toHaveBeenCalled()
        expect(screen.queryByRole('listbox')).toBeNull()
    })

    test('the keys move through the options, Enter picks and Escape closes', () => {
        const onChange = mock(() => {})
        render(<Harness onChange={onChange} />)
        fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
        expect(screen.getByRole('listbox')).toBeTruthy()
        // the picked option has the focus first
        expect(document.activeElement?.textContent).toBe('Pick a repository')
        key('ArrowDown')
        expect(document.activeElement?.textContent).toBe('acme/api')
        key('End')
        expect(document.activeElement?.textContent).toBe('acme/web')
        key('ArrowDown')
        expect(document.activeElement?.textContent).toBe('Pick a repository')
        key('ArrowUp')
        expect(document.activeElement?.textContent).toBe('acme/web')
        key('Home')
        expect(document.activeElement?.textContent).toBe('Pick a repository')

        key('Escape')
        expect(screen.queryByRole('listbox')).toBeNull()
        expect(document.activeElement).toBe(trigger())
        expect(onChange).not.toHaveBeenCalled()
    })

    test('Escape does not reach a dialog behind the menu', () => {
        const onDialogKey = mock(() => {})
        document.addEventListener('keydown', onDialogKey)
        render(<Harness />)
        fireEvent.click(trigger())
        key('Escape')
        expect(onDialogKey).not.toHaveBeenCalled()
        document.removeEventListener('keydown', onDialogKey)
    })

    test('a click outside closes the list', () => {
        render(
            <div>
                <Harness />
                <p>outside</p>
            </div>
        )
        fireEvent.click(trigger())
        fireEvent.mouseDown(screen.getByText('outside'))
        expect(screen.queryByRole('listbox')).toBeNull()
    })

    test('a second click on the button closes the list', () => {
        render(<Harness />)
        fireEvent.click(trigger())
        fireEvent.click(trigger())
        expect(screen.queryByRole('listbox')).toBeNull()
    })

    test('a disabled dropdown does not open', () => {
        render(<Harness disabled />)
        expect((trigger() as HTMLButtonElement).disabled).toBe(true)
        fireEvent.click(trigger())
        expect(screen.queryByRole('listbox')).toBeNull()
    })

    test('plain string options work', () => {
        const onChange = mock(() => {})
        render(
            <SettingsSelect
                label="Size"
                value="small"
                options={['small', 'big']}
                onChange={onChange}
            />
        )
        fireEvent.click(screen.getByRole('button', { name: 'Size' }))
        fireEvent.click(screen.getByRole('option', { name: 'big' }))
        expect(onChange).toHaveBeenCalledWith('big')
    })

    test('PageSizeSelect offers 10, 20 and 30 and gives a number back', () => {
        const onChange = mock((_value: number) => {})
        render(<PageSizeSelect value={10} onChange={onChange} />)
        expect(screen.getByText('Show')).toBeTruthy()
        const button = screen.getByRole('button', { name: 'Rows per page' })
        expect(button.textContent).toContain('10')
        fireEvent.click(button)
        expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['10', '20', '30'])
        fireEvent.click(screen.getByRole('option', { name: '20' }))
        expect(onChange).toHaveBeenCalledWith(20)
    })
})
