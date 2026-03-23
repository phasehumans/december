import { saveProjectFiles } from "./save-project-files";

await saveProjectFiles({
  projectId: "p2",
  versionId: "v1",
  files: [
    {
      path: "src/app/page.tsx",
      content: `export default function Page() {
  return <div>Hello from project p2 🚀</div>;
}`,
    },
    {
      path: "src/app/layout.tsx",
      content: `export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
    },
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "phasehumans-project-p2",
          private: true,
          version: "0.0.1",
        },
        null,
        2
      ),
      contentType: "application/json; charset=utf-8",
    },
  ],
});

console.log("Uploaded p2/v1 to MinIO successfully");