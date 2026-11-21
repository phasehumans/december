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

export interface LearnPromptOptions {
    /** Text the user typed after /learn (empty when the agent finds the lesson itself) */
    lesson: string
    ruleFile: string
    ruleFileExists: boolean
    nestedRuleFiles: string[]
    skillsDir: string
    existingSkillNames: string[]
}

export const getLearnPrompt = (options: LearnPromptOptions) => {
    const { lesson, ruleFile, ruleFileExists, nestedRuleFiles, skillsDir, existingSkillNames } =
        options

    const lessonSection = lesson
        ? `The user gave this lesson:\n<lesson>\n${lesson}\n</lesson>\nSave this lesson. Use the conversation only to make it precise.`
        : `The user gave no text. Find the lesson in the recent conversation. Look for:
- a correction the user made to your work
- a preference or convention the user stated
- a project fact you had to find out (for example a test command or a setup step)
- a fix or procedure that took several attempts to get right
If nothing in the conversation is worth saving, say so in one sentence and stop. Do not write a file.`

    const ruleFileState = ruleFileExists
        ? 'This file exists. Read it before you change it.'
        : 'This file does not exist yet. Create it with a "# AGENTS.md" heading.'

    const nestedSection =
        nestedRuleFiles.length > 0
            ? `\nOther rule files for more specific folders:\n${nestedRuleFiles.map((file) => `- ${file}`).join('\n')}\nWrite to one of these only when the lesson applies only to that folder.\n`
            : ''

    const skillNames = existingSkillNames.length > 0 ? existingSkillNames.join(', ') : 'none'

    return `The user ran /learn. Save a lesson from this conversation so that December follows it in future sessions.

${lessonSection}

## 1. Choose what to save
- Save only what is useful in future sessions: rules, conventions, preferences, project facts, and procedures.
- Do not save details of the current task, temporary state, or facts that the code or git history already shows.
- Write each lesson as a general instruction, not as a story about this conversation.

## 2. Choose the format
- Rule: a constraint, a convention, a preference, or a project fact. Save rules in the rule file.
- Skill: a procedure with several steps that only some tasks need (for example a release runbook or a debug workflow). Save a skill as a SKILL.md file.
- You can save more than one lesson. Keep each one short.

## 3. Write the file
Rule file: ${ruleFile}
${ruleFileState}
${nestedSection}
For rules:
- Put the lesson under the heading that fits it. Add a new heading only when no heading fits.
- When a rule already covers the lesson, update that rule. Do not add a duplicate. When the lesson contradicts a rule, replace the old rule.
- Match the style of the file. Write each rule in one or two lines. Add a short reason when the reason is not obvious.
- Do not change, reorder, or reformat unrelated parts of the file.

For skills:
- Create ${skillsDir}/<name>/SKILL.md. Use a short kebab-case name.
- Existing skills: ${skillNames}. Do not reuse a name. When an existing project skill covers the same procedure, update that skill.
- Use this format:
---
name: <name>
description: <one line: what the skill does and when to use it>
---

# <Title>

<numbered steps, with the exact commands and the checks for each step>

For all files:
- Never write secrets, tokens, passwords, personal data, or absolute paths in the user's home folder. These files are often committed to git.
- Follow the writing rules that the rule files already contain.
- Do not ask for confirmation. Write the file directly.

## 4. Report
Reply briefly with:
- the path of each file you changed
- the exact lines that you added or changed
- one line that says December applies the change from the next session`
}
