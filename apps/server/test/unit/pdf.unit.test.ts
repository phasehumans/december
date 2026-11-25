import { describe, expect, it } from 'bun:test'

import { buildPdf } from '../../src/shared/pdf'

// one byte for each character, so a string index is a byte offset
const read = (pdf: Buffer) => pdf.toString('latin1')

/** the objects the xref table lists: the number of entries and the offset of each object */
const readXref = (pdf: Buffer) => {
    const text = read(pdf)
    const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF\n?$/)?.[1])
    const table = text.slice(startxref)
    const header = table.match(/^xref\n0 (\d+)\n/)
    const count = Number(header?.[1])
    const rows = table.slice(header?.[0].length ?? 0, (header?.[0].length ?? 0) + count * 20)
    const entries = Array.from({ length: count }, (_, index) =>
        rows.slice(index * 20, index * 20 + 20)
    )
    return { text, startxref, count, entries }
}

/** the bytes between "stream" and "endstream", and the /Length written for them */
const readContent = (pdf: Buffer) => {
    const text = read(pdf)
    const match = text.match(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/)
    return { length: Number(match?.[1]), stream: match?.[2] ?? '' }
}

describe('buildPdf', () => {
    const pdf = buildPdf([
        { text: 'December', size: 20, bold: true },
        { text: 'Receipt', size: 14 },
        { text: 'Amount paid: INR 1,905.20' },
    ])

    it('starts with the pdf header and ends with the end of file mark', () => {
        expect(read(pdf).startsWith('%PDF-1.4\n')).toBe(true)
        expect(read(pdf).endsWith('\n%%EOF')).toBe(true)
    })

    it('points startxref at the xref table', () => {
        const { text, startxref } = readXref(pdf)

        expect(text.slice(startxref, startxref + 5)).toBe('xref\n')
    })

    it('points each xref offset at its object', () => {
        const { text, count, entries } = readXref(pdf)

        expect(count).toBe(7)
        expect(entries[0]).toBe('0000000000 65535 f \n')
        for (let number = 1; number < count; number++) {
            const entry = entries[number] ?? ''
            expect(entry).toMatch(/^\d{10} 00000 n \n$/)
            const offset = Number(entry.slice(0, 10))
            expect(text.slice(offset, offset + `${number} 0 obj\n`.length)).toBe(
                `${number} 0 obj\n`
            )
        }
    })

    it('names the catalog as the root and counts every object in the trailer', () => {
        const { text } = readXref(pdf)

        expect(text).toContain('trailer\n<< /Size 7 /Root 1 0 R >>')
        expect(text).toContain('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>')
    })

    it('has one A4 page with the built-in Helvetica fonts', () => {
        const text = read(pdf)

        expect(text).toContain('/Type /Pages /Kids [3 0 R] /Count 1')
        expect(text).toContain('/MediaBox [0 0 595 842]')
        expect(text).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding')
        expect(text).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding')
    })

    it('writes each line as text in the content stream', () => {
        const { stream } = readContent(pdf)

        expect(stream).toContain('/F2 20 Tf')
        expect(stream).toContain('(December) Tj')
        expect(stream).toContain('/F1 14 Tf')
        expect(stream).toContain('(Receipt) Tj')
        expect(stream).toContain('(Amount paid: INR 1,905.20) Tj')
    })

    it('writes the length of the content stream in bytes', () => {
        const { length, stream } = readContent(pdf)

        expect(length).toBe(stream.length)
    })

    it('puts a later line lower on the page', () => {
        const { stream } = readContent(pdf)
        const yOf = (line: string) =>
            Number(stream.match(new RegExp(`1 0 0 1 [\\d.]+ ([\\d.]+) Tm\\n\\(${line}\\) Tj`))?.[1])

        expect(yOf('December')).toBeGreaterThan(yOf('Receipt'))
        expect(yOf('Receipt')).toBeGreaterThan(yOf('Amount paid: INR 1,905.20'))
        expect(yOf('Amount paid: INR 1,905.20')).toBeGreaterThan(0)
    })

    it('escapes ( ) and \\ in the text', () => {
        const { stream } = readContent(buildPdf([{ text: 'a (b) c\\d' }]))

        expect(stream).toContain('(a \\(b\\) c\\\\d) Tj')
    })

    it('keeps a latin-1 character as one byte', () => {
        const bytes = buildPdf([{ text: 'José' }])

        expect(bytes.includes(Buffer.from([0x4a, 0x6f, 0x73, 0xe9]))).toBe(true)
    })

    it('replaces a character outside latin-1 with ?', () => {
        const { stream } = readContent(buildPdf([{ text: '₹500 for 夏 and 🙂' }]))

        expect(stream).toContain('(?500 for ? and ?) Tj')
    })

    it('replaces a line break and a tab with ?, so one line stays one line', () => {
        const { stream } = readContent(buildPdf([{ text: 'a\nb\tc' }]))

        expect(stream).toContain('(a?b?c) Tj')
    })

    it('breaks a line that is too long for the page', () => {
        const email = `${'a'.repeat(120)}@example.com`
        const { stream } = readContent(buildPdf([{ text: email }]))
        const shown = [...stream.matchAll(/\((.*)\) Tj/g)].map((match) => match[1] ?? '')

        expect(shown.length).toBeGreaterThan(1)
        expect(shown.join('')).toBe(email)
        for (const part of shown) {
            expect(part.length).toBeLessThanOrEqual(80)
        }
    })

    it('breaks a long line at a space when it has one', () => {
        const text = `${'word '.repeat(30)}end`
        const { stream } = readContent(buildPdf([{ text }]))
        const shown = [...stream.matchAll(/\((.*)\) Tj/g)].map((match) => match[1] ?? '')

        expect(shown.length).toBeGreaterThan(1)
        expect(shown.join(' ')).toBe(text)
    })

    it('drops the lines that do not fit on the one page', () => {
        const lines = Array.from({ length: 200 }, (_, index) => ({ text: `line ${index}` }))
        const { stream } = readContent(buildPdf(lines))

        expect(stream).toContain('(line 0) Tj')
        expect(stream).not.toContain('(line 199) Tj')
        const ys = [...stream.matchAll(/1 0 0 1 [\d.]+ ([\d.]+) Tm/g)].map((match) =>
            Number(match[1])
        )
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(56)
    })
})
