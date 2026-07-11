import { describe, it, expect } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { parseInlineFormatting, renderRichContent } from '@/features/chat/utils/chatFormatting'

describe('chatFormatting utils', () => {
    describe('parseInlineFormatting', () => {
        it('parses bold formatting', () => {
            const result = parseInlineFormatting('Hello **world**!')
            expect(result).toHaveLength(3)
            // 'Hello ', <strong>world</strong>, '!'
            expect(result[0]).toBe('Hello ')
            expect((result[1] as React.ReactElement).type).toBe('strong')
            expect((result[1] as React.ReactElement).props.children).toBe('world')
            expect(result[2]).toBe('!')
        })

        it('parses italic formatting', () => {
            const result = parseInlineFormatting('Hello *world*!')
            expect((result[1] as React.ReactElement).type).toBe('em')
            expect((result[1] as React.ReactElement).props.children).toBe('world')
        })

        it('parses code formatting', () => {
            const result = parseInlineFormatting('Run `npm start` to begin')
            expect((result[1] as React.ReactElement).type).toBe('code')
            expect((result[1] as React.ReactElement).props.children).toBe('npm start')
        })

        it('handles multiple formats in one string', () => {
            const result = parseInlineFormatting('**bold** and *italic* and `code`')
            expect((result[1] as React.ReactElement).type).toBe('strong')
            expect((result[3] as React.ReactElement).type).toBe('em')
            expect((result[5] as React.ReactElement).type).toBe('code')
        })
    })

    describe('renderRichContent', () => {
        it('returns null for empty string', () => {
            expect(renderRichContent('')).toBeNull()
        })

        it('renders headers correctly', () => {
            const { container } = render(
                <>{renderRichContent('### Header 3\n#### Header 4\n## Header 2')}</>
            )
            expect(container.querySelector('h3')).toBeTruthy()
            expect(container.querySelector('h3')?.textContent).toBe('Header 3')
            expect(container.querySelector('h4')).toBeTruthy()
            expect(container.querySelector('h4')?.textContent).toBe('Header 4')
            expect(container.querySelector('h2')).toBeTruthy()
            expect(container.querySelector('h2')?.textContent).toBe('Header 2')
        })

        it('renders lists correctly', () => {
            const { container } = render(<>{renderRichContent('- item 1\n- item 2\n- item 3')}</>)
            const listItems = container.querySelectorAll('li')
            expect(listItems.length).toBe(3)
            expect(listItems[0].textContent).toBe('item 1')
        })

        it('renders paragraphs correctly', () => {
            const { container } = render(<>{renderRichContent('Just a normal paragraph.')}</>)
            expect(container.querySelector('p')).toBeTruthy()
            expect(container.querySelector('p')?.textContent).toBe('Just a normal paragraph.')
        })
    })
})
