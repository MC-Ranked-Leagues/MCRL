import defaultMdxComponents from "@fumadocs/base-ui/mdx";
import { DocsBody } from "@fumadocs/base-ui/layouts/spacious/page";
import type { MDXComponents } from "mdx/types";

// The Fumadocs integration renders docs content with these components.
// `wrapper` gives the content its prose styles.
export default {
  ...defaultMdxComponents,
  wrapper: DocsBody,
} satisfies MDXComponents;
