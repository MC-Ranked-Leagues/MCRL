# Seed Manager

Seed Manager coordinates Minecraft speedrun seeds from league-scoped upload through tournament use and historical retention.

## Language

**Seed**:
An uploaded set of overworld, nether, end, and RNG values assigned to a league and tournament week.
_Avoid_: Good seed, rated seed

**Active seed**:
A seed assigned to the current tournament week that has not expired.
_Avoid_: Approved seed, good seed

**Used seed**:
An active seed that was played in the tournament and published to the current-week public history.
_Avoid_: Consumed seed

**Expired seed**:
A seed retained as history after its active tournament week ends.
_Avoid_: Archived seed

**Deleted seed**:
A seed record that was permanently removed with its comments; only its audit event remains.
_Avoid_: Bad seed, rejected seed

**Uploader**:
A user who can upload, view, comment on, and correct seeds in assigned uploader leagues.
_Avoid_: Tester

**Host**:
A user who can view and manage active seeds in assigned host leagues, including marking them used.

**Seed testing pause**:
The tournament-wide state that blocks normal seed uploads and deletions during weekly operations.
_Avoid_: Read-only mode
