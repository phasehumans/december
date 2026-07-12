export const getGrillPrompt = (
    userPrompt: string
) => `You are a product manager interviewing a developer.
The user wants to implement: "${userPrompt}"
Generate 5 to 8 questions to clarify the requirements and align on a detailed implementation plan.
Each question must have exactly 3 options.
Return the output as a strict JSON array of objects with the following schema:
[
  {
    "question": "Question text?",
    "options": ["Option 1", "Option 2", "Option 3"]
  }
]
Do not include any other text, markdown formatting, or code blocks. Return raw JSON only.`

export const getPlanPrompt = (
    originalPrompt: string,
    qaPairs: { question: string; answer: string }[]
) => `You are an autonomous software engineer.
The user wants to implement: "${originalPrompt}"
Here is the alignment interview results:
${qaPairs.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}

Please create a detailed, step-by-step implementation plan based on these requirements.
Do NOT execute any tools. Only describe the plan.
Start your response with '### Implementation Plan' and list the concrete steps.
Explain which files need to be created, modified, or deleted, and what the changes will be.`
