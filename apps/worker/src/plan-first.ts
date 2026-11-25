/**
 * "Plan first" for a cloud turn (#632): the agent reads the code, writes a plan and asks
 * the user to approve it (the ask_question tool blocks until the answer) before it
 * changes any file.
 */
export const withPlanFirst = (prompt: string): string => `${prompt}

<plan-first>
The user turned on "plan first" for this message. Follow these steps in order:
1. Read the code you need. Use only tools and commands that read: do not create, edit or delete files, do not install packages, and do not commit or push.
2. Write a short step-by-step plan: which files you will change, and what you will change in each.
3. Call the ask_question tool with one question, "Approve this plan?", and the options "Approve" and "Change the plan".
4. If the user approves, carry out the plan. If the user asks for changes, update the plan and ask again. If the user says to stop, stop and change nothing.
</plan-first>`
