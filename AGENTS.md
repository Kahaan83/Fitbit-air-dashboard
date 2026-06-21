# Agent Instructions — Fitbit Air Dashboard

## Stack
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Zustand
- Backend: FastAPI, Python 3.11, Google Health API (v4), asyncio
- Tests: Pytest (backend), Playwright (frontend E2E)
- Desktop only — no mobile/responsive breakpoints needed anywhere

## Before starting any task
1. Read only the files directly named in the prompt. Do not explore the full tree.
2. If a file path is ambiguous, ask once before reading anything.
3. Do not read node_modules, .next, __pycache__, or any build output.

## Making changes
- Edit the minimum number of files required. Do not refactor adjacent code unless the prompt explicitly asks.
- Do not add comments explaining what you changed — the diff shows that.
- Do not rewrite working code into a "cleaner" style unless asked.
- Preserve all existing CSS variable names exactly. Do not rename vars.
- When adding a new component, put it in the directory the prompt specifies. Do not reorganize imports across other files unless they break.

## Docs and markdown
- Do not update AGENTS.md, README.md, or any .md file unless the prompt explicitly says to.
- Do not add JSDoc or docstrings to functions you didn't write.
- Do not update CHANGELOG or version files.

## Tests
- Do not run Playwright tests unless the prompt explicitly says "run playwright" or "verify with playwright".
- Do not run the full test suite after every change. Run only the specific test file relevant to what changed.
- Backend: pytest tests/.py -v — never pytest . or pytest google-health-service/
- Frontend unit tests: npx vitest run lib/__tests__/.test.ts only
- If a test was already failing before your change, note it and move on — do not fix unrelated test failures.

## What done means
A task is complete when:
- The code change is made
- It compiles / no TypeScript errors in the changed files
- The one relevant test passes (if a test file was named in the prompt)
Done does NOT mean: all tests pass, docs are updated, code is reformatted, or related issues are fixed.