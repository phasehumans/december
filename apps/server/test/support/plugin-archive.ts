import { gzipSync } from 'node:zlib'

// builds a .tar.gz shaped like the archive github sends: a pax global header with the
// commit sha, then every file under one top folder (repo-<ref>/)

type FileValue = string | Buffer | { data: string | Buffer; mode?: number; type?: string }

const header = (data: { name: string; size: number; mode: number; type: string }) => {
    const { name, size, mode, type } = data
    const block = Buffer.alloc(512)
    block.write(name.slice(0, 100), 0, 'utf8')
    block.write(`${mode.toString(8).padStart(7, '0')}\0`, 100, 'ascii')
    block.write('0000000\0', 108, 'ascii')
    block.write('0000000\0', 116, 'ascii')
    block.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 'ascii')
    block.write('00000000000\0', 136, 'ascii')
    block.write('        ', 148, 'ascii')
    block.write(type, 156, 'ascii')
    block.write('ustar\0', 257, 'ascii')
    block.write('00', 263, 'ascii')
    let sum = 0
    for (const byte of block) sum += byte
    block.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii')
    return block
}

const pad = (data: Buffer) => Buffer.concat([data, Buffer.alloc((512 - (data.length % 512)) % 512)])

const paxRecord = (key: string, value: string) => {
    const body = ` ${key}=${value}\n`
    let length = body.length + 1
    while (`${length}${body}`.length !== length) length += 1
    return `${length}${body}`
}

export const makeRepoArchive = (
    files: Record<string, FileValue>,
    options: { sha?: string | null; top?: string } = {}
): Buffer => {
    const { sha = 'a'.repeat(40), top = 'repo-HEAD' } = options
    const blocks: Buffer[] = []
    if (sha) {
        const pax = Buffer.from(paxRecord('comment', sha), 'utf8')
        blocks.push(header({ name: 'pax_global_header', size: pax.length, mode: 0o666, type: 'g' }))
        blocks.push(pad(pax))
    }
    blocks.push(header({ name: `${top}/`, size: 0, mode: 0o755, type: '5' }))
    for (const [path, value] of Object.entries(files)) {
        const item = typeof value === 'string' || Buffer.isBuffer(value) ? { data: value } : value
        const data = Buffer.isBuffer(item.data) ? item.data : Buffer.from(item.data, 'utf8')
        const name = `${top}/${path}`
        if (name.length > 100) {
            const pax = Buffer.from(paxRecord('path', name), 'utf8')
            blocks.push(header({ name: 'pax', size: pax.length, mode: 0o644, type: 'x' }))
            blocks.push(pad(pax))
        }
        const type = item.type ?? '0'
        const size = type === '0' ? data.length : 0
        blocks.push(header({ name, size, mode: item.mode ?? 0o644, type }))
        if (size > 0) blocks.push(pad(data))
    }
    blocks.push(Buffer.alloc(1024))
    return gzipSync(Buffer.concat(blocks))
}
