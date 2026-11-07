# TODO

- Switch `apps/web` to Astro's default `compressHTML: "jsx"` and remove the
  override in `astro.config.mjs`. Text split across lines around inline tags
  then loses its space, so add `{" "}` where it shows, such as the people and
  teams count on the credits page and several spots on the championship page.
- Unpin `astro` (7.4.6 in `apps/web`) and the `@astrojs/mdx` override (8.1.2
  in the root `package.json`) once `@fumadocs/astro` supports Sätteri 0.11.
  Until then, newer versions render code blocks in the info pages as a block
  inside a block.
