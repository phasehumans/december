import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

let cachedChromePath: string | null | undefined = undefined

export function resetChromePathCache(): void {
    cachedChromePath = undefined
}

export async function isExecutable(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath, fs.constants.X_OK)
        const stats = await fs.stat(filePath)
        return stats.isFile()
    } catch {
        // Intentionally swallowed: file not accessible or not executable
        return false
    }
}

export async function findSystemChrome(): Promise<string | null> {
    if (cachedChromePath !== undefined) {
        return cachedChromePath
    }

    // 1. Check environment variables
    const envVars = ['CHROME_PATH', 'CHROME_BIN', 'CHROMIUM_PATH', 'PUPPETEER_EXECUTABLE_PATH']

    for (const envVar of envVars) {
        const val = process.env[envVar]
        if (val && (await isExecutable(val))) {
            cachedChromePath = val
            return val
        }
    }

    const platform = os.platform()

    // 2. Platform-specific known candidate paths
    const candidates: string[] = []

    if (platform === 'linux') {
        candidates.push(
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
            '/usr/bin/brave-browser',
            '/usr/bin/microsoft-edge',
            '/usr/bin/microsoft-edge-stable'
        )
    } else if (platform === 'darwin') {
        const home = os.homedir()
        candidates.push(
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            path.join(home, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
            path.join(home, 'Applications/Chromium.app/Contents/MacOS/Chromium')
        )
    } else if (platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA || ''
        const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
        const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'

        candidates.push(
            path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
            path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
            path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
            path.join(localAppData, 'BraveSoftware\\Brave-Browser\\Application\\brave.exe')
        )
    }

    for (const candidate of candidates) {
        if (await isExecutable(candidate)) {
            cachedChromePath = candidate
            return candidate
        }
    }

    // 3. Fallback: check PATH via `which` / `where`
    const binaryNames =
        platform === 'win32'
            ? ['chrome.exe', 'msedge.exe', 'brave.exe']
            : [
                  'google-chrome',
                  'google-chrome-stable',
                  'chromium',
                  'chromium-browser',
                  'brave-browser',
                  'microsoft-edge',
              ]

    const whichCmd = platform === 'win32' ? 'where' : 'which'

    for (const bin of binaryNames) {
        try {
            const out = execSync(`${whichCmd} ${bin}`, {
                stdio: ['ignore', 'pipe', 'ignore'],
                encoding: 'utf-8',
            }).trim()

            const firstLine = out.split('\n')[0]?.trim()
            if (firstLine && (await isExecutable(firstLine))) {
                cachedChromePath = firstLine
                return firstLine
            }
        } catch {
            // Intentionally swallowed: binary not found in PATH
        }
    }

    cachedChromePath = null
    return null
}

export async function isChromeAvailable(): Promise<boolean> {
    const chrome = await findSystemChrome()
    return chrome !== null
}
