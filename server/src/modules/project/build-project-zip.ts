type ZipEntry = {
    path: string
    content: string
}

const crcTable = new Uint32Array(256)

for (let index = 0; index < 256; index += 1) {
    let current = index

    for (let bit = 0; bit < 8; bit += 1) {
        current = (current & 1) === 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1
    }

    crcTable[index] = current >>> 0
}

const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff

    for (const value of bytes) {
        crc = crcTable[(crc ^ value) & 0xff]! ^ (crc >>> 8)
    }

    return (crc ^ 0xffffffff) >>> 0
}

const concatBuffers = (chunks: Uint8Array[]) => {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
    }

    return result
}

export const buildProjectZip = (entries: ZipEntry[]) => {
    const encoder = new TextEncoder()
    const localChunks: Uint8Array[] = []
    const centralChunks: Uint8Array[] = []
    let offset = 0

    for (const entry of entries) {
        const normalizedPath = entry.path.replace(/\\/g, '/')
        const nameBytes = encoder.encode(normalizedPath)
        const contentBytes = encoder.encode(entry.content)
        const checksum = crc32(contentBytes)
        const utf8Flag = 0x0800

        const localHeader = new Uint8Array(30 + nameBytes.length + contentBytes.length)
        const localView = new DataView(localHeader.buffer)
        localView.setUint32(0, 0x04034b50, true)
        localView.setUint16(4, 20, true)
        localView.setUint16(6, utf8Flag, true)
        localView.setUint16(8, 0, true)
        localView.setUint16(10, 0, true)
        localView.setUint16(12, 0, true)
        localView.setUint32(14, checksum, true)
        localView.setUint32(18, contentBytes.length, true)
        localView.setUint32(22, contentBytes.length, true)
        localView.setUint16(26, nameBytes.length, true)
        localView.setUint16(28, 0, true)
        localHeader.set(nameBytes, 30)
        localHeader.set(contentBytes, 30 + nameBytes.length)
        localChunks.push(localHeader)

        const centralHeader = new Uint8Array(46 + nameBytes.length)
        const centralView = new DataView(centralHeader.buffer)
        centralView.setUint32(0, 0x02014b50, true)
        centralView.setUint16(4, 20, true)
        centralView.setUint16(6, 20, true)
        centralView.setUint16(8, utf8Flag, true)
        centralView.setUint16(10, 0, true)
        centralView.setUint16(12, 0, true)
        centralView.setUint16(14, 0, true)
        centralView.setUint32(16, checksum, true)
        centralView.setUint32(20, contentBytes.length, true)
        centralView.setUint32(24, contentBytes.length, true)
        centralView.setUint16(28, nameBytes.length, true)
        centralView.setUint16(30, 0, true)
        centralView.setUint16(32, 0, true)
        centralView.setUint16(34, 0, true)
        centralView.setUint16(36, 0, true)
        centralView.setUint32(38, 0, true)
        centralView.setUint32(42, offset, true)
        centralHeader.set(nameBytes, 46)
        centralChunks.push(centralHeader)

        offset += localHeader.length
    }

    const centralDirectory = concatBuffers(centralChunks)
    const endRecord = new Uint8Array(22)
    const endView = new DataView(endRecord.buffer)
    endView.setUint32(0, 0x06054b50, true)
    endView.setUint16(4, 0, true)
    endView.setUint16(6, 0, true)
    endView.setUint16(8, entries.length, true)
    endView.setUint16(10, entries.length, true)
    endView.setUint32(12, centralDirectory.length, true)
    endView.setUint32(16, offset, true)
    endView.setUint16(20, 0, true)

    return concatBuffers([...localChunks, centralDirectory, endRecord])
}
