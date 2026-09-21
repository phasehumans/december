import { fileURLToPath } from 'url'
import path from 'path'
import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import tailwindcss from '@tailwindcss/vite'
import dotenv from 'dotenv'

const rootDir = fileURLToPath(new URL('../../', import.meta.url))
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
dotenv.config({ path: path.join(rootDir, envFile) })
dotenv.config({ path: path.join(rootDir, '.env') })

export default defineConfig({
    site: 'https://trydecember.com',
    output: 'static',
    server: {
        port: 2000,
    },
    preview: {
        port: 2000,
    },
    redirects: {
        '/pricing': 'https://app.trydecember.com/settings/billing',
        '/settings/billing': 'https://app.trydecember.com/settings/billing',
        '/settings/usage': 'https://app.trydecember.com/settings/usage',
        '/twitter': 'https://x.com/phasehumans',
        '/x': 'https://x.com/phasehumans',
        '/youtube': 'https://www.youtube.com/@phasehumans',
        '/yt': 'https://www.youtube.com/@phasehumans',
        '/changelog': 'https://github.com/phasehumans/december/blob/main/CHANGELOG.md',
    },
    integrations: [mdx()],
    markdown: {
        shikiConfig: {
            theme: 'github-light',
        },
    },
    vite: {
        envDir: rootDir,
        plugins: [tailwindcss()],
        define: {
            'import.meta.env.WEB_URL': JSON.stringify(
                process.env.WEB_URL ||
                    (process.env.NODE_ENV === 'production'
                        ? 'https://trydecember.com'
                        : 'http://localhost:2000')
            ),
            'import.meta.env.APP_URL': JSON.stringify(
                process.env.APP_URL ||
                    (process.env.NODE_ENV === 'production'
                        ? 'https://app.trydecember.com'
                        : 'http://localhost:3000')
            ),
            'import.meta.env.SERVER_URL': JSON.stringify(
                process.env.SERVER_URL ||
                    (process.env.NODE_ENV === 'production'
                        ? 'https://api.trydecember.com'
                        : 'http://localhost:4000')
            ),
        },
    },
})
