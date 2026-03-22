# Repository Guidelines

## Project Structure & Module Organization

This repository is currently documentation-first. The checked-in files live under `docs/superpowers/`:

- `docs/superpowers/specs/` holds approved design specs.
- `docs/superpowers/plans/` holds implementation plans and task breakdowns.

The spec defines the intended monorepo layout once scaffolded:

- `packages/shared/` for normalized types and errors
- `packages/ubereats-client/` and `packages/thuisbezorgd-client/` for platform clients
- `packages/mcp-server/` for MCP tool handlers
- `tools/api-capture/` for mitmproxy capture and parsing utilities
- `docs/api-reference/` for generated endpoint notes

## Build, Test, and Development Commands

No runnable workspace files are checked in yet, so there is nothing to build or test from this snapshot alone. The implementation plan expects a `pnpm` workspace with these root commands after bootstrap:

- `pnpm install` installs shared dev dependencies.
- `pnpm build` builds all workspace packages.
- `pnpm test` runs all Vitest suites.
- `pnpm typecheck` runs strict TypeScript checks.

Use `pnpm --version` first; the plan expects `pnpm` 8+.

## Coding Style & Naming Conventions

Follow the conventions defined in the design and plan docs:

- TypeScript uses ESM, `NodeNext`, and `strict: true`.
- Prefer small focused modules such as `client.ts`, `auth.ts`, `mappers.ts`, and `types.ts`.
- Keep shared domain models in `packages/shared/src/`.
- Use kebab-case for package directories and lowercase filenames.
- Use clear exported type names such as `Restaurant`, `Cart`, and `PlatformClient`.

## Testing Guidelines

Vitest is the planned test framework. Place tests beside each package in a `tests/` directory and name files `*.test.ts`, for example `packages/shared/tests/errors.test.ts`.

Add unit tests for new parsing, mapping, and error-handling code. Run `pnpm test` and `pnpm typecheck` before opening a PR.

## Commit & Pull Request Guidelines

Local `.git` history is not present in this workspace snapshot, so no repository-specific history can be inspected. Use the commit style already shown in the implementation plan, for example `chore: bootstrap pnpm workspace`.

PRs should link the relevant spec or plan, describe the affected package paths, and include evidence of validation. For tooling or capture work, include sample commands or generated output paths such as `tools/api-capture/output/`.

## Security & Configuration Tips

Do not commit `.env`, captured credentials, or raw API session data. Keep capture output under ignored paths and document any required secrets in setup docs rather than hardcoding them.
