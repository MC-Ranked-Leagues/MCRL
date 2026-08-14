USE BUN AS A PACKAGE MANAGER AND RUN ALL COMMANDS WITH BUN (where aplicable).

When prompted to brainstorm, use short, concise and meaningful ideas, rather than fully planned responses. Ask questions, and ecourage collaboration. Keep the response relatively short.

For product-facing changes and app intend, read `SPEC.md` first.

DO NOT RUN COMMANDS/CHANGES IN THE PROD ENV

## Code quality

Do not try to create components and abstract function that are only used once.

Prefer using one file per react component, unless it makes sense not to (for example helper components). For helper functions however, try and put them in the lib folder. Do not put everything into one file.

When writing ui, check for components to reuse. Also, search the codebase for similar ui that is hard coded. If yes, let me know to extract them.

## Testing

For most testing, prefer simple typecheck over writing browser and custom tests for most changes. Only when changing multiple features, files and functionallity, when writing complicated code and when rewriting core app features, consider more testing options.
