import { saveProjectFiles } from './save-project-files'

await saveProjectFiles({
    projectId: 'p1',
    versionId: 'v1',
    files: [
        {
            path: 'src/app/page.tsx',
            content: `export default function Page() {
  return <div>Hello December 🚀</div>;
}`,
        },
        {
            path: 'package.json',
            content: JSON.stringify(
                {
                    name: 'december-project',
                    private: true,
                    version: '0.0.1',
                },
                null,
                2
            ),
            contentType: 'application/json; charset=utf-8',
        },
    ],
})

console.log('Uploaded to MinIO successfully')
