# Web Design

Every page uses the obsidian design, and `body` in `global.css` sets its base
text and focus ring. The championship page is kept only as an archive with its
own styling, and stays out of the navbar. The info docs run on Fumadocs, which
takes its colors from `docs.css`.

Keep new UI on the shared values so pages don't drift apart:

- Colors come from the `@theme` tokens in `global.css`. Movement uses
  `promoted`, `demoted` and their `-tint` variants. Raw hex is only for data
  colors, such as the run phase colors.
- Panel and control borders are `border-3`. Content width is `max-w-page`.
- Selected items use lava: a fill for segmented controls like the league
  picker, and an underline or edge bar for list items. Hover is
  `bg-obsidian-raised`. Gold marks first place and winners.
- Times, points, percentages and player names use `font-minecraft`. Headings
  already get it from the base styles.
- Page titles are `text-4xl md:text-6xl`, section headings
  `text-3xl md:text-4xl`, and panel headings `text-2xl`. Data numbers are
  `text-lg` bold, with larger sizes only for showcases like the podium.
- Use `PlayerHead` at its default size in lists, `Skeleton` for loading
  placeholders, and `Drawer` for mobile sheets. Load faces and match players
  by UUID, since names can change.
- Format run times and percentages with `lib/format.ts`, and movement with
  `lib/movement.ts`. The UI only says promoted, demoted or stayed, because
  projected moves aren't final.
- External links live in `src/links.ts`, and the site name is `SITE_NAME` in
  `src/consts.ts`.

In code and copy, a match is one league match (`matchNumber`), a Ranked match
is MCSR Ranked API data (`rankedMatchId`), and a run is one player's attempt
in a match. A seed's `order` comes from Seed Manager and keeps its own name.
