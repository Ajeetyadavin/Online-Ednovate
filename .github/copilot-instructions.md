# Copilot Project Instructions (Low-Token + High-Recall)

## Primary context sources
- Start with `.planning/codebase/CODEBASE_CONTEXT_COMPACT.md` for architecture and module map.
- Then read only the minimum relevant files for the task.
- Prefer existing repo memory notes under `/memories/repo/` before scanning large folders.

## Token efficiency rules
- Avoid reading entire directories unless explicitly requested.
- Use focused symbol/file search first, then targeted reads.
- Summarize findings in compact bullet points.
- Reuse existing naming patterns and APIs to avoid exploratory churn.

## Accuracy rules
- Verify assumptions against source files before changing behavior.
- Prefer minimal diffs and preserve existing patterns.
- Run relevant tests/lint for touched areas when feasible.

## Admin panel focus
- Many admin workflows are hybrid: React Context + backend APIs.
- Check `src/context/PlatformDataContext.tsx`, `src/services/adminApi.ts`, and matching `src/pages/admin/*` before implementing changes.
