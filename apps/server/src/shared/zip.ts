import zlib from 'zlib'

export type ZipEntry = {
    /** path inside the zip, with forward slashes */
    name: string
    content: string | Buffer
}

/** the MS-DOS time and date fields a zip entry stores */
const toDosDateTime = (date: Date) => {
    const time =
        (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
    const day =
        ((Math.max(date.getFullYear(), 1980) - 1980) << 9) |
        ((date.getMonth() + 1) << 5) |
        date.getDate()
    return { time, day }
}

/**
 * A zip file (deflate, UTF-8 names) built in memory. It is for small archives, such as a
 * data export: no zip64, so the archive and each entry must stay under 4 GB.
 */
export const buildZip = (entries: ZipEntry[], modifiedAt = new Date()): Buffer => {
    const { time, day } = toDosDateTime(modifiedAt)
    const localParts: Buffer[] = []
    const centralParts: Buffer[] = []
    let offset = 0

    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8')
        const raw = typeof entry.content === 'string' ? Buffer.from(entry.content) : entry.content
        const compressed = zlib.deflateRawSync(raw)
        const crc = zlib.crc32(raw)

        const local = Buffer.alloc(30)
        local.writeUInt32LE(0x04034b50, 0)
        local.writeUInt16LE(20, 4) // version needed
        local.writeUInt16LE(0x0800, 6) // names are UTF-8
        local.writeUInt16LE(8, 8) // deflate
        local.writeUInt16LE(time, 10)
        local.writeUInt16LE(day, 12)
        local.writeUInt32LE(crc, 14)
        local.writeUInt32LE(compressed.length, 18)
        local.writeUInt32LE(raw.length, 22)
        local.writeUInt16LE(name.length, 26)
        local.writeUInt16LE(0, 28) // extra field length
        localParts.push(local, name, compressed)

        const central = Buffer.alloc(46)
        central.writeUInt32LE(0x02014b50, 0)
        central.writeUInt16LE(20, 4) // version made by
        central.writeUInt16LE(20, 6) // version needed
        central.writeUInt16LE(0x0800, 8)
        central.writeUInt16LE(8, 10)
        central.writeUInt16LE(time, 12)
        central.writeUInt16LE(day, 14)
        central.writeUInt32LE(crc, 16)
        central.writeUInt32LE(compressed.length, 20)
        central.writeUInt32LE(raw.length, 24)
        central.writeUInt16LE(name.length, 28)
        // extra, comment, disk, internal and external attributes stay 0
        central.writeUInt32LE(offset, 42)
        centralParts.push(central, name)

        offset += local.length + name.length + compressed.length
    }

    const centralDirectory = Buffer.concat(centralParts)
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(entries.length, 8)
    end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(centralDirectory.length, 12)
    end.writeUInt32LE(offset, 16)

    return Buffer.concat([...localParts, centralDirectory, end])
}
