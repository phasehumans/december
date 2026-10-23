const EXCLUDED_PORTS = new Set<number>([
    22, // SSH
    25, // SMTP
    53, // DNS
    111, // RPC
    3306, // MySQL
    5432, // PostgreSQL
    6379, // Redis
    27017, // MongoDB
])

const PREFERRED_WEB_PORTS = [5173, 3000, 8080, 8000, 4200, 5000, 4000, 8008, 3001, 5174]

export const parseListeningPortsOutput = (output: string): number[] => {
    if (!output || typeof output !== 'string') return []

    const ports = new Set<number>()
    const lines = output.split(/\r?\n|\\n/)

    for (const line of lines) {
        // ss -tln or netstat -tln matching
        // e.g. LISTEN 0 511 0.0.0.0:3000 0.0.0.0:*
        // e.g. LISTEN 0 511 *:5173 *:*
        const ssMatch = line.match(
            /(?:0\.0\.0\.0|\*|127\.0\.0\.1|\[::\]|:::):(\d+)\b.*?(?:LISTEN|\*|\()/i
        )
        if (ssMatch && ssMatch[1]) {
            const port = parseInt(ssMatch[1], 10)
            if (!isNaN(port) && !EXCLUDED_PORTS.has(port) && port >= 80 && port <= 65535) {
                // Ignore privileged ports < 1024 unless standard web 80/443
                if (port >= 1024 || port === 80 || port === 443) {
                    ports.add(port)
                }
            }
        }

        // lsof -iTCP -sTCP:LISTEN matching
        // e.g. TCP *:8080 (LISTEN)
        const lsofMatch = line.match(
            /TCP\s+(?:\*|127\.0\.0\.1|0\.0\.0\.0|\[::\]|:::):(\d+)\s+\(LISTEN\)/i
        )
        if (lsofMatch && lsofMatch[1]) {
            const port = parseInt(lsofMatch[1], 10)
            if (!isNaN(port) && !EXCLUDED_PORTS.has(port) && port >= 80 && port <= 65535) {
                if (port >= 1024 || port === 80 || port === 443) {
                    ports.add(port)
                }
            }
        }
    }

    return Array.from(ports).sort((a, b) => a - b)
}

export const pickWebPreviewPort = (ports: number[]): number | null => {
    if (!ports || ports.length === 0) return null

    // 1. Check preferred dev server ports in order
    for (const preferred of PREFERRED_WEB_PORTS) {
        if (ports.includes(preferred)) {
            return preferred
        }
    }

    // 2. Otherwise return first detected unprivileged port
    const unprivileged = ports.find((p) => p >= 1024)
    return unprivileged || ports[0] || null
}

export const detectSandboxListeningPorts = async (sandbox: any): Promise<number[]> => {
    if (!sandbox) return []

    try {
        let output = ''
        const inspectCmd =
            'ss -tln 2>/dev/null || lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null || netstat -tln 2>/dev/null'

        if (typeof sandbox.executeCommand === 'function') {
            await sandbox.executeCommand(inspectCmd, (chunk: string) => {
                output += chunk
            })
        } else if (sandbox.commands && typeof sandbox.commands.run === 'function') {
            const res = await sandbox.commands.run(inspectCmd)
            output = res.stdout || res.output || ''
        }

        return parseListeningPortsOutput(output)
    } catch (err) {
        // Intentionally swallowed: Return empty candidate array if sandbox command fails
        return []
    }
}
