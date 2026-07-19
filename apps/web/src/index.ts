import path from 'path'

import { serve } from 'bun'

import index from './index.html'

const server = serve({
    routes: {
        // serve index.html for all unmatched routes.
        '/*': index,
    },

    async fetch(req) {
        const url = new URL(req.url)
        const pathname = url.pathname

        // 1. serve api routes
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

        // 2. serve static files from 'public' directory
        const publicFilePath = path.join(import.meta.dir, '../public', pathname)
        const file = Bun.file(publicFilePath)
        const exists = await file.exists()
        console.log(
            `[Static File Check] URL: ${pathname} | Resolved Path: ${publicFilePath} | Exists: ${exists}`
        )
        if (exists) {
            return new Response(file)
        }

        // 3. fallback: return undefined to let bun match routes
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
