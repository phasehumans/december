import path from 'path'

import { serve } from 'bun'
import dotenv from 'dotenv'

import index from './index.html'

const rootDir = path.resolve(import.meta.dir, '../../')
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
dotenv.config({ path: path.join(rootDir, envFile) })
dotenv.config({ path: path.join(rootDir, '.env') })

const isProd = process.env.NODE_ENV === 'production'
const SERVER_URL =
    process.env.SERVER_URL || (isProd ? 'https://api.trydecember.com' : 'http://localhost:4000')

const proxyBackendApi = (req: Request) => {
    const url = new URL(req.url)
    const normalizedTarget = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL
    const targetUrl = `${normalizedTarget}${url.pathname}${url.search}`
    const headers = new Headers(req.headers)
    try {
        headers.set('host', new URL(normalizedTarget).host)
    } catch {
        headers.set('host', isProd ? 'api.trydecember.com' : 'localhost:4000')
    }

    const options: RequestInit & { duplex?: string } = {
        method: req.method,
        headers,
        redirect: 'manual',
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        options.body = req.body
        options.duplex = 'half'
    }

    return fetch(targetUrl, options)
}

const NPM_PACKAGE_URL = 'https://www.npmjs.com/package/@trydecember/cli'

const server = serve({
    port: Number(process.env.APP_PORT || process.env.WEB_PORT || 3000),
    routes: {
        '/install.sh': () => Response.redirect(NPM_PACKAGE_URL, 302),
        '/install': () => Response.redirect(NPM_PACKAGE_URL, 302),
        '/docs': () => {
            const targetBase =
                process.env.WEB_URL ||
                (isProd ? 'https://trydecember.com' : 'http://localhost:2000')
            return Response.redirect(`${targetBase}/docs`, 302)
        },
        '/docs/*': (req: Request) => {
            const url = new URL(req.url)
            const targetBase =
                process.env.WEB_URL ||
                (isProd ? 'https://trydecember.com' : 'http://localhost:2000')
            return Response.redirect(`${targetBase}${url.pathname}${url.search}`, 302)
        },
        '/robots.txt': () => {
            const file = Bun.file(path.join(import.meta.dir, '../assets/robots.txt'))
            return new Response(file, {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
        },
        '/sitemap.xml': () => {
            const file = Bun.file(path.join(import.meta.dir, '../assets/sitemap.xml'))
            return new Response(file, {
                headers: { 'Content-Type': 'application/xml; charset=utf-8' },
            })
        },
        '/api/v1/*': proxyBackendApi,
        '/*': index,
    },

    async fetch(req) {
        const url = new URL(req.url)
        const pathname = url.pathname

        // 1. serve test api routes
        if (pathname === '/api/hello') {
            if (req.method === 'GET') {
                return Response.json({
                    message: 'Hello, world!',
                    method: 'GET',
                })
            }
            if (req.method === 'PUT') {
                return Response.json({
                    message: 'Hello, world!',
                    method: 'PUT',
                })
            }
        }

        if (pathname.startsWith('/api/hello/')) {
            const name = pathname.slice('/api/hello/'.length)
            return Response.json({
                message: `Hello, ${name}!`,
            })
        }

        // 2. serve static files from 'assets' directory
        const assetsFilePath = path.join(import.meta.dir, '../assets', pathname)
        const file = Bun.file(assetsFilePath)
        const exists = await file.exists()
        if (exists) {
            return new Response(file)
        }

        return undefined as any
    },

    development: process.env.NODE_ENV !== 'production' && {
        // enable browser hot reloading in development
        hmr: true,

        // echo console logs from the browser to the server
        console: true,
    },
})

console.log(`Server running at ${server.url}`)
