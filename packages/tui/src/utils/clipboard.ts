import { spawnSync } from 'child_process'
import * as os from 'os'

export function writeToClipboard(text: string) {
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
    } catch (err) {
        console.error('Failed to copy to clipboard', err)
    }
}
