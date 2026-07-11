export const mapStoredFilesToGeneratedFiles = (files: Record<string, string>) =>
    Object.fromEntries(
        Object.entries(files).map(([path, content]) => [
            path,
            {
                path,
                content,
                status: 'done' as const,
            },
        ])
    )
