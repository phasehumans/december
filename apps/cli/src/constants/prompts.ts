export const getPlanPrompt = (
    originalPrompt: string,
    qaPairs?: { question: string; answer: string }[]
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

export const getAskPrompt = (question: string) => `You are in Ask mode (read-only Q&A).
The user is asking: "${question}"

Guidelines:
1. Answer the user's question thoroughly, clearly, and accurately based on the codebase.
2. You can use your available tools (search, read files, list directories, search web) to inspect and verify code facts.
3. You CANNOT and MUST NOT modify any files, write new files, or run bash/terminal commands.
4. Provide comprehensive explanations, referencing relevant file paths, types, functions, and code snippets directly in your answer.`
