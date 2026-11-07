# TODO

- Switch `apps/web` to Astro's default `compressHTML: "jsx"` and remove the
  override in `astro.config.mjs`. Text split across lines around inline tags
  then loses its space, so add `{" "}` where it shows, such as the people and
  teams count on the credits page and several spots on the championship page.
