import { apiRequest } from '@/shared/api/client'

export interface SessionFileContent {
    path: string
    /** empty when the file is empty or is not in the saved workspace */
    content: string
}

/** one file of the session workspace, read from the saved workspace */
const getSessionFile = async (sessionId: string, path: string): Promise<SessionFileContent> => {
    const data = await apiRequest<SessionFileContent>(
        `/session/${sessionId}/file?path=${encodeURIComponent(path)}`
    )
    return data || { path, content: '' }
}

export const sessionFilesAPI = { getSessionFile }
