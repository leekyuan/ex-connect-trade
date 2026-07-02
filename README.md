# CryptoEdgeAI - Main Dashboard

This repository is the main GitHub codebase connected to the Lovable project:

CryptoEdgeAI - Main Dashboard

## Purpose

CryptoEdgeAI is a crypto trading signal dashboard and trading assistant project.

The project must prioritize safety, reviewability, and clear separation between UI, signal logic, risk controls, and any future trading automation.

## Source of Truth

This repository is the main project source.

Do not use old Remix projects as the main version unless explicitly requested.

## Required Reading for AI Agents

Before Codex, Claude, Lovable, or any AI tool modifies this project, read:

- `PROJECT_STATUS.md`
- `SAFETY_RULES.md`
- `CHANGELOG.md`
- `PROMPT_HISTORY.md`

## Safety Principles

- Live trading must be disabled by default.
- Paper/test mode must be the default mode.
- API keys and secrets must never be committed.
- Risk controls must not be removed.
- Backtest or signal results must not be described as guaranteed profit.
- Any trading-related feature must include failure handling and manual stop logic.

## Development Notes

This project is synced from Lovable to GitHub.

Avoid renaming, moving, or deleting this repository without checking Lovable sync first.
