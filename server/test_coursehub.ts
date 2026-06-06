import { prisma } from './src/config/db'
import { getTextFile } from './src/modules/project/project-storage'

async function main() {
    const project = await prisma.project.findFirst({
        where: { name: 'CourseHub' },
        orderBy: { updatedAt: 'desc' },
    })
    if (!project) {
        console.log('no project')
        return
    }
    const currentVersion = await prisma.projectVersion.findFirst({
        where: { id: project.currentVersionId },
    })

    const frontendFile = currentVersion.manifestJson.find((f) => f.path === 'src/frontend.tsx')
    if (frontendFile) {
        const content = await getTextFile(frontendFile.key)
        console.log('--- frontend.tsx ---\n' + content)
    } else {
        console.log('no frontend.tsx')
    }
    await prisma.$disconnect()
}
main().catch(console.error)
