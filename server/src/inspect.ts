import { prisma } from './config/db'

async function run() {
    const projects = await prisma.project.findMany()
    for (const p of projects) {
        console.log(`ID: ${p.id}, Name: ${p.name}, isSharedAsTemplate: ${p.isSharedAsTemplate}`)
    }
}

run().catch(console.error)
