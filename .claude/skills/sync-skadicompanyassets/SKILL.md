---
name: sync-skadicompanyassets
description: Sync this project with the skadicompanyassets repo — pull updates from skadicompanyassets, push project learnings back as PRs.
when_to_use: |
  - User mentions skadicompanyassets, "the assets repo", or shared standards.
  - User says "we should update this everywhere" or "this is a Skadi-wide pattern".
  - User says "what does the assets repo say about X".
  - Starting a new feature that touches brand, legal, or technical baselines.
---

# Sync Skadi Assets

This skill keeps Numlore aligned with the central `skadicompanyassets` repository and helps route reusable local learnings back into the shared source of truth.

## Purpose

Use this skill when the current project needs guidance from the shared assets repo or when a local pattern should be proposed back to `skadicompanyassets`.

## Installation

This skill lives at `.claude/skills/sync-skadicompanyassets/SKILL.md`. `skadicompanyassets` is cloned as a sibling directory at `../skadicompanyassets/` so the skill can inspect the canonical docs directly during planning and review work.

## Pull workflow

Read `../skadicompanyassets/CHANGELOG.md` since the last known sync, inspect the relevant docs for the task at hand, summarize the meaningful delta, and propose the corresponding project changes.

## Push workflow

When a pattern in Numlore should be standardized across Skadi properties, draft a focused PR against `skadicompanyassets/<folder>/<file>.md` and explain why the learning is generalizable. Examples that might warrant a push:

- The build-time `scripts/privacy-audit.ts` pattern — if other Skadi properties want the same hard-fail enforcement.
- Hybrid Astro + Cloudflare patterns for tool-app projects with heavy pSEO surface area, if a third Skadi property hits the same shape.

## Trigger phrases

- User mentions `skadicompanyassets`, "the assets repo", or shared standards.
- User says "we should update this everywhere" or "this is a Skadi-wide pattern".
- User says "what does the assets repo say about X".
- Starting a new feature that touches brand, legal, or technical baselines.
