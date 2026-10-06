# Contributing to Agentfaces

Thanks for helping. Bug reports, docs fixes and new ideas are all welcome.

## Setup

```sh
git clone https://github.com/ajibadedapo/agentfaces.git
cd agentfaces
npm install
npm test
npm run docs:dev
```

Node 20 or newer is required for development.

## Checks

Every pull request runs the same checks as CI:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run size
```

## Guidelines

- Keep the core (`src/core`, exported from `agentfaces`) free of runtime dependencies and free of any framework.
- Renderers live in `src/react` and `src/react-native` and share behaviour through the core.
- New expressions must pass `validateFace` and the face-fit tests for every shape and pose.
- Keep the bundle within the budgets in `.size-limit.json`. If a change needs more, explain why in the pull request.
- Prefer clear names over comments. Public API types may carry short doc comments.
- All contributions must be your own original work.

## Releasing

Versions are managed with [changesets](https://github.com/changesets/changesets). If your change affects users, run `npx changeset` and commit the generated file. When changes land on `main`, a release pull request is opened automatically. Merging it publishes to npm with provenance.

## Code of conduct

This project follows the [Code of Conduct](./CODE_OF_CONDUCT.md).
