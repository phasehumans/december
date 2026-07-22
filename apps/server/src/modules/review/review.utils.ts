export function parsePrUrl(prUrl: string) {
    const match = prUrl.match(
        /(?:github\.com|gitlab\.com)\/([^/]+\/[^/]+)\/(?:pull|merge_requests)\/(\d+)/i
    )
    return {
        repository: match && match[1] ? match[1] : null,
        prNumber: match && match[2] ? parseInt(match[2], 10) : null,
        provider: prUrl.includes('gitlab.com') ? 'GITLAB' : 'GITHUB',
    }
}
