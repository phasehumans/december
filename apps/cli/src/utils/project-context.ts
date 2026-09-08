import fs from 'node:fs'
import path from 'node:path'

export function getProjectContext(workspaceDir: string = process.cwd()): string {
    const parts: string[] = []

    try {
        const pkgPath = path.join(workspaceDir, 'package.json')
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
            const deps = Object.keys(pkg.dependencies || {})
                .slice(0, 15)
                .join(', ')
            const devDeps = Object.keys(pkg.devDependencies || {})
                .slice(0, 10)
                .join(', ')
            parts.push(`Project: ${pkg.name || 'Unnamed'}`)
            if (deps) parts.push(`Dependencies: ${deps}`)
            if (devDeps) parts.push(`DevDependencies: ${devDeps}`)
        }

        const agentsPath = path.join(workspaceDir, 'AGENTS.md')
        if (fs.existsSync(agentsPath)) {
            const content = fs.readFileSync(agentsPath, 'utf8')
            parts.push(`Guidelines (from AGENTS.md):\n${content.slice(0, 500)}`)
        }

        const entries = fs
            .readdirSync(workspaceDir, { withFileTypes: true })
            .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
            .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
            .slice(0, 20)
        if (entries.length > 0) {
            parts.push(`Workspace layout: ${entries.join(', ')}`)
        }
    } catch {
        // Intentionally swallowed: fallback to empty context on filesystem error
    }

    return parts.join('\n')
}
