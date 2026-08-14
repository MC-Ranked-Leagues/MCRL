ALWAYS USE BUN WHEN POSSIBLE.

When prompted to brainstorm, use short, concise and meaningful ideas, rather than fully planned responses. Ask questions, and ecourage collaboration. Keep the response relatively short.

Never commit without user approval.

For project overview and usage, read `seed-manager-routing.plan.md` and `seed-manager-v1.plan.md`.

For new actions, ask me if I want to log it.

## Code quality

Do not try to create components and abstract function that are only used once.

Prefer using one file per react component, unless it makes sense not to (for example helper components). For helper functions however, try and put them in the lib folder. Do not put everything into one file.

When writing ui, check for components to reuse. Also, search the codebase for similar ui that is hard coded. If yes, let me know to extract them.

## Testing

For most testing, prefer simple typecheck over writing browser and custom tests for most changes. Only when changing multiple features, files and functionallity, when writing complicated code and when rewriting core app features, consider more testing options.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

In Convex mutations and internal mutations, always signal failures by throwing a `ConvexError`. Never return an error object or error status from a mutation handler: returning counts as a successful transaction and will not roll back earlier writes.

<!-- convex-ai-end -->
