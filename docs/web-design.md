# Web Design

Every page uses the same dark design, and `body` in `global.css` sets its base
text and focus ring. The championship page is kept only as an archive with its
own styling, and stays out of the navbar. The info docs run on Fumadocs, which
takes its colors from `docs.css`.

Keep new UI on the shared values so pages don't drift apart:

- Colors come from the `@theme` tokens in `global.css`. Movement uses
  `promoted`, `demoted` and their `-tint` variants. Raw hex is only for data
  colors, such as the run phase colors.
- Rules and panel edges are 1px `border`, and controls such as buttons and
  fields are `border-2`. Content width is `max-w-page`.
- Selected items use `primary`: a fill for segmented controls like the league
  picker, and an underline or edge bar for list items. Hover is
  `bg-background-raised`. Gold marks first place and winners, so links and
  labels don't use it.
- Headings get the Minecraft font from the base styles. Times, points,
  percentages, player names and buttons use `font-minecraft` too. Only
  buttons and selected picker items bold it. Use `pixel-shadow` where bold
  would go elsewhere; headings already have it.
- Its pixels are 0.1em, so headings take only the `text-pixel-*` sizes,
  which are multiples of 10px. Page titles are
  `text-pixel-lg md:text-pixel-xl`, section headings
  `text-pixel-md md:text-pixel-lg`, and panel headings `text-pixel-sm`. Data
  numbers are `text-lg` with `pixel-shadow`.
- Nothing animates in on page load.
- Tooltips and hover cards use the `hover-card` class, and text fields use
  `field`.
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
