import { spawn } from 'child_process'
import path from 'path'

type getWebClips = {
    url: string
}

const getWebClips = async (data: getWebClips) => {
    return new Promise((resolve, reject) => {
        const workerPath = path.resolve(process.cwd(), 'src', 'utils', 'clipper.js')
        const worker = spawn('node', [workerPath, data.url])

        let output = ''

        worker.stdout.on('data', (data) => {
            output += data.toString()
        })

        worker.stderr.on('data', (err) => {
            console.error(err.toString())
        })

        worker.on('close', (code) => {
            if (code !== 0) {
                return reject('Clipper failed')
            }

            resolve(JSON.parse(output))
        })
    })
}

export const canvasService = {
    getWebClips,
}
