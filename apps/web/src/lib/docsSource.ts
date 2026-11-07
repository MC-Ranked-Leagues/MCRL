import { getCollection } from "astro:content";
import { loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import { toFumadocsSource } from "@fumadocs/astro/source";

export const docsSource = loader({
  source: toFumadocsSource(
    await getCollection("docs"),
    await getCollection("meta")
  ),
  baseUrl: "/info",
  // Turns `icon` names in frontmatter and meta.json into Lucide icons.
  plugins: [lucideIconsPlugin()],
});
