import { prisma } from './src/config/db'
import { getTextFile } from './src/modules/project/project-storage'

async function main() {
    const latestProject = await prisma.project.findFirst({ orderBy: { updatedAt: 'desc' } })
    const currentVersion = await prisma.projectVersion.findFirst({
        where: { id: latestProject.currentVersionId },
    })

    const frontendFile = currentVersion.manifestJson.find((f) => f.path === 'src/frontend.tsx')
    if (frontendFile) {
        const content = await getTextFile(frontendFile.key)
        console.log('--- frontend.tsx ---\n' + content)
    } else {
        console.log('No frontend.tsx found in manifest.')
    }
    await prisma.$disconnect()
}
main().catch(console.error)
