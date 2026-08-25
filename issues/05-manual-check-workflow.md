# 05 — The manual check runs on this repository's pull requests

**Status:** PR open
**Type:** AFK
**Lane:** deploylog-widget
**Parent:** deploylog/issues/93-chapter-00-cross-refs-set-publish-v1.md
**Blocked by:** None — can start immediately
**Commit:** 03bfa50
**Verification:** the `Manual check` workflow runs on this pull request and finishes; on a later pull request that changes `src/widget.ts`, the claims chapter 04 pins to it are evaluated (touched > 0 in the run summary) instead of counting as unmapped

## What to build
Chapter 04 of the DeployLog manual cites `src/widget.ts`, `src/types.ts`, `src/styles.ts` and `README.md` in this repository (35 claims). A run of the Action's verify mode checks only the claims that cite the repository it runs in, so from the deploylog repo those 35 report `unmapped_repository`, and no push anywhere verifies them (`deploylog manual verify`, 2026-08-25). Add `.github/workflows/manual-check.yml`, the same file the deploylog repo runs (`deploylogdev/action@v1`, `mode: verify`, `project: deploylog`, `fail-on` left at its default `none` so the check annotates and never blocks; flip to `drift` when a drift should block a merge). The `DEPLOYLOG_API_KEY` secret already exists in this repository (the publish workflow uses it).

## Acceptance criteria
- [ ] `.github/workflows/manual-check.yml` on main, byte-identical to the deploylog repo's apart from the comment
- [ ] The `Manual check` run on the pull request that adds it completes (a run that adds no source file evaluates zero claims: that is the expected first result, not a failure)
- [ ] The first later pull request touching `src/widget.ts` shows the chapter 04 claims evaluated

## Boundaries
- Do NOT change the publish workflow (`deploylog.yml`) or CI
- Do NOT add secrets by hand; report if one is missing
