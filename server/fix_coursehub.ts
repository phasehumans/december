import { prisma } from './src/config/db'
import { putTextFile, getTextFile } from './src/modules/project/project-storage'

async function main() {
    const project = await prisma.project.findFirst({
        where: { name: 'CourseHub' },
        orderBy: { updatedAt: 'desc' },
    })
    if (!project) return
    const currentVersion = await prisma.projectVersion.findFirst({
        where: { id: project.currentVersionId },
    })

    const frontendFile = currentVersion.manifestJson.find((f) => f.path === 'src/frontend.tsx')
    if (frontendFile) {
        const newKey = `projects/${project.id}/previous-version/${currentVersion.id}/src/frontend.tsx`
        const content = `import "./index.css";\nimport React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\n\nconst root = document.getElementById("root");\nif (root) {\n  ReactDOM.createRoot(root).render(<App />);\n}`
        await putTextFile({ key: newKey, content })

        const newManifest = currentVersion.manifestJson.map((f) => {
            if (f.path === 'src/frontend.tsx') {
                return { ...f, key: newKey }
            }
            return f
        })
        await prisma.projectVersion.update({
            where: { id: currentVersion.id },
            data: { manifestJson: newManifest },
        })
        console.log('Fixed S3 and DB!')
    }
    await prisma.$disconnect()
}
main().catch(console.error)
