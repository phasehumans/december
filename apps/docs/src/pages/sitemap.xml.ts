import type { APIRoute } from 'astro'

// Every page under src/pages, found at build time so the sitemap never misses a page.
const pageFiles = Object.keys(import.meta.glob('./**/*.{astro,mdx}'))

function routeFromFile(file: string): string {
    const route = file
        .replace(/^\.\//, '/')
        .replace(/\.(astro|mdx)$/, '')
        .replace(/\/index$/, '')
    return route === '/index' || route === '' ? '/' : route
}

export const GET: APIRoute = ({ site }) => {
    const base = (site?.toString() ?? 'https://trydecember.com/').replace(/\/$/, '')
    const routes = pageFiles
        .filter((file) => !file.includes('[') && !/\/404\.astro$/.test(file))
        .map(routeFromFile)
        .sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)))

    const urls = routes.map(
        (route) => `  <url>\n    <loc>${base}${route === '/' ? '/' : route}</loc>\n  </url>`
    )
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
    return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
