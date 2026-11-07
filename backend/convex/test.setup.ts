/// <reference types="vite/client" />

// Same files as convex-test's documented "./**/!(*.*.*)*.*s", which matches
// nothing under Vite 8: every .ts/.js file except multi-dot ones like tests.
export const modules = import.meta.glob(["./**/*.*s", "!./**/*.*.*"]);
