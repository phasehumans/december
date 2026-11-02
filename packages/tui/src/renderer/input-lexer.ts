/**
 * Splits a raw stdin chunk into individual key events and ANSI escape sequences.
 * This ensures multi-sequence bursts from high-speed trackpad gestures, mouse wheels,
 * or fast key combinations are not dropped or corrupted.
 */
export function splitInputSequences(raw: string): string[] {
    if (!raw || raw.length === 0) {
        return []
    }

    // Fast path: pure text without any escape characters
    if (!raw.includes('\x1b')) {
        // If there are control characters mixed with normal text, split control characters
        const sequences: string[] = []
        let textBuf = ''

        for (let i = 0; i < raw.length; i++) {
            const code = raw.charCodeAt(i)
            // Separate Ctrl+C (\x03), Return (\r, \n), Tab (\t), Backspace (\x7f, \b)
            if (code < 32 || code === 127) {
                if (textBuf.length > 0) {
                    sequences.push(textBuf)
                    textBuf = ''
                }
                sequences.push(raw[i]!)
            } else {
                textBuf += raw[i]
            }
        }

        if (textBuf.length > 0) {
            sequences.push(textBuf)
        }

        return sequences
    }

    const sequences: string[] = []
    let i = 0

    while (i < raw.length) {
        if (raw[i] === '\x1b') {
            // Check if there is a following sequence
            if (i + 1 >= raw.length) {
                sequences.push('\x1b')
                i += 1
                continue
            }

            const next = raw[i + 1]

            // 1. CSI sequence: \x1b[...
            if (next === '[') {
                // Bracketed paste: \x1b[200~ <pasted text> \x1b[201~
                if (raw.slice(i, i + 6) === '\x1b[200~') {
                    const pasteEnd = raw.indexOf('\x1b[201~', i + 6)
                    if (pasteEnd !== -1) {
                        sequences.push(raw.slice(i, pasteEnd + 6))
                        i = pasteEnd + 6
                        continue
                    }
                }

                // SGR Mouse: \x1b[<digits;digits;digits[Mm]
                if (raw[i + 2] === '<') {
                    let endIdx = i + 3
                    while (endIdx < raw.length && raw[endIdx] !== 'M' && raw[endIdx] !== 'm') {
                        endIdx++
                    }
                    if (endIdx < raw.length) {
                        sequences.push(raw.slice(i, endIdx + 1))
                        i = endIdx + 1
                        continue
                    }
                }

                // Standard CSI: \x1b[ [0-9;?]* [A-Za-z~]
                let endIdx = i + 2
                while (
                    endIdx < raw.length &&
                    ((raw.charCodeAt(endIdx) >= 48 && raw.charCodeAt(endIdx) <= 57) || // 0-9
                        raw[endIdx] === ';' ||
                        raw[endIdx] === '?')
                ) {
                    endIdx++
                }

                if (endIdx < raw.length) {
                    const finalChar = raw[endIdx]!
                    if (
                        (finalChar >= 'A' && finalChar <= 'Z') ||
                        (finalChar >= 'a' && finalChar <= 'z') ||
                        finalChar === '~'
                    ) {
                        sequences.push(raw.slice(i, endIdx + 1))
                        i = endIdx + 1
                        continue
                    }
                }

                // Fallback for incomplete or standalone CSI
                sequences.push(raw.slice(i, Math.min(raw.length, i + 2)))
                i = Math.min(raw.length, i + 2)
                continue
            }

            // 2. SS3 sequence: \x1bO[A-Za-z]
            if (next === 'O' && i + 2 < raw.length) {
                sequences.push(raw.slice(i, i + 3))
                i += 3
                continue
            }

            // 3. Escape + single key: \x1b.
            sequences.push(raw.slice(i, i + 2))
            i += 2
            continue
        }

        // Non-escape character: collect text or single control char
        const code = raw.charCodeAt(i)
        if (code < 32 || code === 127) {
            sequences.push(raw[i]!)
            i += 1
        } else {
            let nextEsc = raw.indexOf('\x1b', i)
            if (nextEsc === -1) nextEsc = raw.length

            // Find if there's any control character before next escape
            let endText = nextEsc
            for (let c = i; c < nextEsc; c++) {
                const charCode = raw.charCodeAt(c)
                if (charCode < 32 || charCode === 127) {
                    endText = c
                    break
                }
            }

            sequences.push(raw.slice(i, endText))
            i = endText
        }
    }

    return sequences
}
