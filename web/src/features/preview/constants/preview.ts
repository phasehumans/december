export const PREVIEW_HTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preview</title>
    <style>
        :root {
            color-scheme: dark;
            font-family: "Segoe UI", sans-serif;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background:
                radial-gradient(circle at top, rgba(255, 255, 255, 0.08), transparent 40%),
                linear-gradient(180deg, #101010 0%, #171717 100%);
            color: rgba(255, 255, 255, 0.86);
        }

        .preview-shell {
            width: min(520px, calc(100vw - 32px));
            padding: 32px;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.04);
            backdrop-filter: blur(12px);
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
        }

        h1 {
            margin: 0 0 12px;
            font-size: 22px;
            line-height: 1.2;
        }

        p {
            margin: 0;
            color: rgba(255, 255, 255, 0.62);
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <section class="preview-shell">
        <h1>Preview unavailable</h1>
        <p>The current project does not have a renderable preview document yet. Use the code tab to inspect the generated files, then apply an edit if you want to adjust the implementation.</p>
    </section>
</body>
</html>
`
