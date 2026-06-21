# Behavior Rules

## Token efficiency
- Read a file once. Do not re-read it to confirm your own edit.
- Do not summarize what you are about to do before doing it.
- Do not explain the change after making it unless asked.
- Do not list all the files you considered but didn't touch.

## File reads
- Never read a file just to check if it exists — attempt the edit and handle the error if it fails.
- Never read package.json, tsconfig.json, or tailwind.config.ts unless the prompt is specifically about dependencies or config.
- Never read globals.css unless the prompt is specifically about styling or CSS variables.

## Playwright specifically
- Never run npx playwright test or any variant unless explicitly told to.
- Never install browsers (npx playwright install) mid-task.
- If asked to write a Playwright test, write the file only — do not execute it.
- If a prompt says "add E2E test", create the .spec.ts file and stop.

## Code generation
- Do not generate placeholder functions with TODO bodies unless the prompt says "scaffold".
- Do not add console.log statements unless asked.
- Do not add error boundaries or loading states beyond what the prompt specifies.
- Use the CSS variables already defined in globals.css. Do not hardcode hex values.
- All new React components: functional, no class components, no default prop patterns.

## Scope control
- If a prompt touches component A, do not also "fix" component B even if you notice an issue.
- Note the issue in a single line at the end: "Note: [file] has [issue] — not changed." Then stop.
- Do not install new npm or pip packages unless the prompt names them explicitly.

## Quality non-negotiables (never skip these)
- TypeScript: no `any` types in new code. Use proper types or `unknown` with a guard.
- Async: every async function call must be awaited. No floating promises.
- CSS vars: use var(--name) not hardcoded colors in any component file.
- Empty states: if a chart receives empty data in live mode, show EmptyChartState — never render sample data without labeling it as sample.