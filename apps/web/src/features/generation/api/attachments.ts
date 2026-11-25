import type { AttachmentInfo } from '@december/shared/attachments'

import { apiRequest } from '@/shared/api/client'

/** stores one file for a session. the prompt then carries the id it gets back (#634) */
const upload = async (sessionId: string, file: File): Promise<AttachmentInfo> => {
    const data = await apiRequest<{ attachment: AttachmentInfo }>(
        `/session/${sessionId}/attachments?name=${encodeURIComponent(file.name)}`,
        {
            method: 'POST',
            // the file itself is the body. the server reads the type from the bytes
            headers: { 'Content-Type': 'application/octet-stream' },
            body: file,
        }
    )
    return data.attachment
}

/** removes a stored file that no sent message has, so it no longer counts to the session cap */
const remove = async (sessionId: string, attachmentId: string): Promise<void> => {
    await apiRequest<null>(`/session/${sessionId}/attachments/${attachmentId}`, {
        method: 'DELETE',
    })
}

export const attachmentAPI = { upload, remove }
