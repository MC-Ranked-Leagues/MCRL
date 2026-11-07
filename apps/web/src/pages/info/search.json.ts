import type { APIRoute } from "astro";
import { createFromSource } from "fumadocs-core/search/server";
import { docsSource } from "@/lib/docsSource";

const server = createFromSource(docsSource, { language: "english" });

// The search index of the info pages, which the search dialog downloads.
export const GET: APIRoute = () => server.staticGET();
