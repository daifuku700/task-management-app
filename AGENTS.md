# Repository Guidelines

## Project Structure & Module Organization
This repository is currently in an initial scaffold state. At the time of writing, only repository-local tool metadata exists under `.serena/`, and no application source, tests, or asset directories have been committed yet.

When implementation starts, keep the layout predictable:
- `src/`: application code
- `tests/`: automated tests mirroring `src/`
- `docs/`: design notes and operational documents
- `assets/`: static files such as images or sample data

Prefer small, focused modules and group code by feature rather than by file type when the project grows.

## Build, Test, and Development Commands
No build or test toolchain is configured yet. Until one is added, keep contributor workflows simple and explicit:
- `git status`: confirm the working tree before and after edits
- `rg --files`: inspect repository contents quickly
- `find . -maxdepth 2 -type f`: verify newly added files

Once a runtime stack is chosen, document the canonical local commands here, for example:
- `npm install && npm test`
- `uv sync && uv run pytest`
- `make dev`

Do not introduce multiple parallel ways to run the same task unless there is a clear reason.

## Coding Style & Naming Conventions
Match the conventions of the primary language once it is introduced. Until then, use these defaults:
- Indentation: 2 spaces for frontend configs, 4 spaces for Python or backend code
- File and directory names: lowercase with hyphens or `snake_case`
- Classes and components: `PascalCase`
- Functions and variables: `camelCase` in JavaScript/TypeScript, `snake_case` in Python

Keep comments minimal and useful. Use English inside code comments and user-facing repository documents in clear Markdown.

## Testing Guidelines
Add tests with each feature instead of postponing coverage. Mirror the source layout inside `tests/` and use descriptive names such as `test_task_creation.py` or `task-form.test.ts`.

Before opening a pull request, run the project's documented test command and note the result in the PR description.

## Commit & Pull Request Guidelines
There is no established commit history in this repository yet. Use short, imperative commit messages such as `Add task list skeleton` or `Set up API routes`.

Pull requests should stay focused on one logical change and include:
- a short purpose summary
- key implementation notes
- test evidence or a note that no tests exist yet
- screenshots for UI changes when applicable

Update this file whenever the repository gains a concrete stack, new top-level directories, or required developer tooling.
