import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    site: 'https://trydecember.com',
    output: 'static',
    server: {
        port: 2000,
    },
    preview: {
        port: 2000,
    },
    integrations: [mdx()],
    vite: {
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
