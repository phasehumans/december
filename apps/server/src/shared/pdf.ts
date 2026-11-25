export type PdfLine = {
    text: string
    /** font size in points. the default is 11 */
    size?: number
    bold?: boolean
    /** more space above the line, in points */
    gap?: number
}

// A4 in points
const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 56
const DEFAULT_SIZE = 11
const LINE_HEIGHT = 1.4
// a Helvetica letter is about half its size wide. the estimate keeps a long line on the page
const LETTER_WIDTH = 0.55

/**
 * The text as the pdf can show it with a built-in font: printable ASCII and the latin-1
 * letters stay, each other character (a line break, an emoji, a rupee sign) becomes "?".
 */
const toLatin1 = (text: string): string =>
    Array.from(text, (char) => {
        const code = char.codePointAt(0) ?? 0
        const shown = (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)
        return shown ? char : '?'
    }).join('')

/** a pdf string between ( and ): the backslash and the two brackets need a backslash */
const escapeText = (text: string): string => text.replace(/[\\()]/g, (char) => `\\${char}`)

/** the text in parts that fit the page: cut at the last space, or inside a word with no space */
const wrapText = (text: string, maxLetters: number): string[] => {
    const parts: string[] = []
    let rest = text
    while (rest.length > maxLetters) {
        const space = rest.lastIndexOf(' ', maxLetters)
        if (space > 0) {
            parts.push(rest.slice(0, space))
            rest = rest.slice(space + 1)
        } else {
            parts.push(rest.slice(0, maxLetters))
            rest = rest.slice(maxLetters)
        }
    }
    parts.push(rest)
    return parts
}

/** a number in the content stream: at most two decimals, and no exponent */
const point = (value: number): string => String(Number(value.toFixed(2)))

/** the page content: one text object for each line, from the top margin down */
const buildContent = (lines: PdfLine[]): string => {
    const content: string[] = []
    let y = PAGE_HEIGHT - MARGIN

    for (const line of lines) {
        const size = line.size ?? DEFAULT_SIZE
        const maxLetters = Math.max(
            Math.floor((PAGE_WIDTH - 2 * MARGIN) / (size * LETTER_WIDTH)),
            1
        )
        const parts = wrapText(toLatin1(line.text), maxLetters)

        for (const [index, part] of parts.entries()) {
            y -= size * LINE_HEIGHT + (index === 0 ? (line.gap ?? 0) : 0)
            // one page only: the lines under the bottom margin are left out
            if (y < MARGIN) return content.join('\n')
            content.push(
                'BT',
                `/${line.bold ? 'F2' : 'F1'} ${point(size)} Tf`,
                `1 0 0 1 ${MARGIN} ${point(y)} Tm`,
                `(${escapeText(part)}) Tj`,
                'ET'
            )
        }
    }
    return content.join('\n')
}

/**
 * A pdf file built in memory: one A4 page of text lines in Helvetica, for a small document
 * such as a receipt. No images, no page breaks: a line that does not fit on the page is
 * left out, and a line that is too wide is cut into more lines.
 */
export const buildPdf = (lines: PdfLine[]): Buffer => {
    const content = Buffer.from(buildContent(lines), 'latin1')

    const objects: Buffer[] = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ].map((body) => Buffer.from(body, 'latin1'))
    objects.push(
        Buffer.concat([
            Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'latin1'),
            content,
            Buffer.from('\nendstream', 'latin1'),
        ])
    )

    // the second line has four bytes over 127: it tells a reader that the file is binary
    const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]
    const offsets: number[] = []
    let offset = parts[0]!.length

    for (const [index, body] of objects.entries()) {
        const object = Buffer.concat([
            Buffer.from(`${index + 1} 0 obj\n`, 'latin1'),
            body,
            Buffer.from('\nendobj\n', 'latin1'),
        ])
        offsets.push(offset)
        parts.push(object)
        offset += object.length
    }

    // each xref entry is 20 bytes: a 10 digit offset, a 5 digit generation, n or f
    const xref = [
        'xref',
        `0 ${objects.length + 1}`,
        '0000000000 65535 f ',
        ...offsets.map((value) => `${String(value).padStart(10, '0')} 00000 n `),
        'trailer',
        `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
        'startxref',
        String(offset),
        '%%EOF',
    ].join('\n')
    parts.push(Buffer.from(xref, 'latin1'))

    return Buffer.concat(parts)
}
