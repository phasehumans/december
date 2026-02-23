import { GoogleGenAI } from '@google/genai'

const SYSTEM_INSTRUCTION = `
You are an expert Frontend Engineer and UI/UX Designer.
Your task is to generate a complete, single-file HTML website based on the user's request.

Technical Constraints:
1. Output ONLY the raw HTML code. Do NOT wrap it in markdown code blocks (e.g., \`\`\`html).
2. The code must be self-contained in a single file.
3. Use Tailwind CSS for styling via CDN: <script src="https://cdn.tailwindcss.com"></script>
4. Use Google Fonts (Inter, Roboto, etc.) via CDN.
5. You may use Vanilla JavaScript within <script> tags for interactivity.
6. You may use FontAwesome or Lucide icons via CDN if needed.

Design Guidelines:
- Create modern, high-quality, and responsive interfaces similar to outputs from v0.dev or bolt.new.
- If no specific theme is requested, default to a modern "Dark Mode" aesthetic using warm dark greys (e.g., #171615, #1D1C1B) to match the "PhaseHumans" application theme.
- Ensure good contrast and accessibility.
- Add subtle animations (fade-ins, hover states) to make the page feel alive.

Example Output Structure:
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    ...
</head>
<body class="bg-[#171615] text-white">
    ...
</body>
</html>
`

export const generateWebsiteCode = async (prompt: string): Promise<string> => {
    try {
        // Ensure API Key is present
        if (!process.env.API_KEY) {
            console.warn('API Key is missing. Please set process.env.API_KEY.')
            return `<div style="display:flex;height:100vh;justify-content:center;align-items:center;color:#fff;background:#111;font-family:sans-serif;">
        <div style="text-align:center;">
            <h2 style="margin-bottom:1rem;">API Key Missing</h2>
            <p style="opacity:0.7;">Please configure your API_KEY to generate websites.</p>
        </div>
      </div>`
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY })

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
            },
        })

        let code = response.text || ''

        // Clean up potential markdown formatting from the LLM if it slips through
        code = code
            .replace(/```html/g, '')
            .replace(/```/g, '')
            .trim()

        return code
    } catch (error) {
        console.error('Error generating website:', error)
        return `<!-- Error Report -->
    <div style="display:flex;height:100vh;justify-content:center;align-items:center;color:#fff;background:#171615;font-family:sans-serif;">
      <div style="text-align:center;">
        <h2 style="margin-bottom:10px;font-size:1.5rem;">Generation Failed</h2>
        <p style="opacity:0.7;">An error occurred while communicating with the AI.</p>
      </div>
    </div>`
    }
}
