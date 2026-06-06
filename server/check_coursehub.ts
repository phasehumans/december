import { prisma } from './src/config/db'
import { getTextFile } from './src/modules/project/project-storage'

async function main() {
    const project = await prisma.project.findFirst({
        where: { name: 'CourseHub' },
        orderBy: { updatedAt: 'desc' },
    })
    const currentVersion = await prisma.projectVersion.findFirst({
        where: { id: project.currentVersionId },
    })

    const frontendFile = currentVersion.manifestJson.find((f) => f.path === 'src/frontend.tsx')
    console.log('Current version ID:', currentVersion.id)
    console.log('Frontend file key in DB:', frontendFile.key)

    try {
        const content = await getTextFile(frontendFile.key)
        console.log('Does it have import css? ', content.includes('import "./index.css"'))
    } catch (e) {
        console.log('Error fetching from S3:', e.message)
    }

    await prisma.$disconnect()
}
main().catch(console.error)
