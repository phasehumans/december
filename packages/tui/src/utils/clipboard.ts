import { spawnSync } from 'child_process'
import * as os from 'os'

export function writeToClipboard(text: string) {
    if (!text) return

    // Write OSC 52 escape sequence for zero-latency terminal clipboard copy
    try {
        if (process.stdout?.isTTY) {
            const base64 = Buffer.from(text, 'utf8').toString('base64')
            process.stdout.write(`\x1b]52;c;${base64}\x07`)
        }
    } catch {
        // Intentionally swallowed: ignore OSC 52 write errors on unsupported terminals
    }

    const platform = os.platform()
    try {
        const isWsl =
            platform === 'linux' &&
            (!!process.env.WSL_DISTRO_NAME || os.release().toLowerCase().includes('microsoft'))
        if (platform === 'darwin') {
            spawnSync('pbcopy', { input: text })
        } else if (platform === 'win32') {
            spawnSync('clip', { input: text })
        } else if (isWsl) {
            spawnSync('clip.exe', { input: text })
        } else if (platform === 'linux') {
            const xclip = spawnSync('xclip', ['-selection', 'clipboard', '-in'], { input: text })
            if (xclip.error) {
                spawnSync('xsel', ['--clipboard', '--input'], { input: text })
            }
        }
    } catch {
        // Intentionally swallowed: fallback to terminal-based clipboard handling
    }
}
