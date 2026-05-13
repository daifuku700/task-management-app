# Repository Guidelines

## Project Structure & Module Organization
This repository contains a task management application with separate backend, frontend, and infrastructure code.

- `backend/`: FastAPI backend code, Python packaging files, and its Dockerfile
- `frontend/`: Vite/React frontend code, npm packaging files, and its Dockerfile
- `terraform/`: AWS infrastructure definitions for the backend deployment
- `docs/`: design notes and operational documents
- `compose.yml`: local multi-container application entrypoint

Prefer small, focused modules and group code by feature rather than by file type when the project grows.

## Build, Test, and Development Commands
Useful repository inspection commands:
- `git status`: confirm the working tree before and after edits
- `rg --files`: inspect repository contents quickly
- `find . -maxdepth 2 -type f`: verify newly added files

Known project commands:
- `docker compose -f compose.yml up --build`: run the local application stack
- `uv run pytest`: run backend tests when tests are added
- `npm install --prefix frontend`: install frontend dependencies
- `npm run build --prefix frontend`: build the frontend
- `terraform -chdir=terraform plan`: preview the default real AWS infrastructure
- `terraform -chdir=terraform plan -var deployment_target=floci -var aws_region=us-east-1`: preview the Floci-targeted infrastructure

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
