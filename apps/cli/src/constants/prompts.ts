export const getGrillPrompt = (
    userPrompt: string,
    projectContext?: string
) => `You are a principal software architect interviewing a developer to align on a technical specification before implementation.

The user wants to implement: "${userPrompt}"

${projectContext ? `<project_context>\n${projectContext}\n</project_context>\n` : ''}
Analyze the user's request and the project context. Generate between 1 and 4 targeted, high-impact multiple-choice questions to clarify critical requirements, architectural choices, tech stack decisions, and edge cases. If the task is simple and unambiguous, generate fewer questions (e.g. 1 or 2). Do not ask more than 4 questions.

Requirements for questions:
1. Focus on technical depth: probe architectural tradeoffs, API design, state management, edge cases, and error handling.
2. Each question MUST have 2 to 3 distinct, concrete options representing clear design choices.
3. Leverage the provided project context (if available) to tailor choices specifically to the existing codebase patterns.

Return the output strictly as a JSON array of objects with the following schema:
[
  {
    "question": "Question text?",
    "options": ["Option 1 (Design choice A)", "Option 2 (Design choice B)", "Option 3 (Design choice C)"]
  }
]

Do not include any other text, markdown formatting, or code blocks. Return raw JSON only.`

export const getPlanPrompt = (
    originalPrompt: string,
    qaPairs: { question: string; answer: string }[]
) => `You are an autonomous software engineer.
The user wants to implement: "${originalPrompt}"
${
    qaPairs && qaPairs.length > 0
        ? `Here is the alignment interview results:
${qaPairs.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}\n`
        : ''
}
Please create a detailed, step-by-step implementation plan based on these requirements.
Do NOT execute any tools. Only describe the plan.
Start your response with '### Implementation Plan' and list the concrete steps.
Explain which files need to be created, modified, or deleted, and what the changes will be.`

export const getPlanExecutionPrompt = (
    originalPrompt: string,
    planText: string,
    qaPairs?: { question: string; answer: string }[]
) => `You are an autonomous software engineer.
The user has approved the implementation plan for: "${originalPrompt}".

${
    qaPairs && qaPairs.length > 0
        ? `Key alignment decisions from the interview:
${qaPairs.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}\n\n`
        : ''
}Approved Implementation Plan:
${planText}

You are now in execution mode. Proceed with implementation immediately.
Execute the plan step-by-step using your available tools (file editing, file creation, bash commands).
Do not wait for further confirmation before starting tool execution.
Report your progress as you complete each step.
If a tool execution fails or encounters unexpected errors, do not repeat the failing action in a loop. Assess the failure, adjust your approach or remaining steps, and if critical information is missing, ask for clarification.`

export const getPlanRefinePrompt = (
    originalPrompt: string,
    previousPlan: string,
    feedback: string,
    qaPairs?: { question: string; answer: string }[]
) => `You are an autonomous software engineer.
The user wants to implement: "${originalPrompt}"

${
    qaPairs && qaPairs.length > 0
        ? `Previous alignment interview results:
${qaPairs.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}\n\n`
        : ''
}Previous Implementation Plan:
${previousPlan}

The user provided the following feedback to refine the plan:
"${feedback}"

Please update and refine the detailed, step-by-step implementation plan based on this feedback.
Do NOT execute any tools. Only describe the updated plan.
Start your response with '### Implementation Plan' and list the concrete updated steps.
Explain which files need to be created, modified, or deleted, and what the changes will be.`
