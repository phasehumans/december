import { spawn } from "child_process"


type getWebClips = {
    url: string
}

const getWebClips = async (data: string) => {
    return new Promise((resolve, reject) => {
        const worker = spawn("node", ["../../utils/clipper.js", data])
    
        let output = ""
    
        worker.stdout.on("data", (data) => {
          output += data.toString()
        })
    
        worker.stderr.on("data", (err) => {
          console.error(err.toString())
        })
    
        worker.on("close", (code) => {
          if (code !== 0) {
            return reject("Clipper failed")
          }
    
          resolve(JSON.parse(output))
        })
      })
}

getWebClips("https://www.notion.com/")


export const canvasService = {
    getWebClips
}
