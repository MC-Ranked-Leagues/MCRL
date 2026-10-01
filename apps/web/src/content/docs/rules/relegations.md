---
title: Promotions and demotions
description: How players move between leagues.
---

At the end of each week, we promote and relegate players to ensure that the leagues are balanced and that the competition is fair.

## Leagues 1-6

Promotions and demotions are done by 3-week average performance, counting the current week and up to 2 of the most recent appearances. Missing every seed makes you ineligible for movement that week.

Performance is calculated by taking a reverse ranking of all players who got points that week, and dividing it by the number of people who received points. If you received no points, you are unranked and your performance is 0.

Here's how we do the math:

```
a (number of players who have at least 1 point) \
n (your placement, 1st = 1, 2nd = 2, etc) \

performance = (a - n + 1) / a
```

So for example if you got 3rd place and 15 people got points, your performance would be:

> (15 - 3 + 1) / 15 = 13 / 15 ≈ 0.867 = 86.7%

Then we take the average and rank everyone who played the week by that average. If the average is tied, the player with a better weekly placement ranks higher.

Number of promotions and demotions is 15% of the number of people who played the week, rounded to nearest whole number. So for example, if 25 people played, the number of promotions and demotions would be:

> 25 * 0.15 = 3.75 ≈ 4.

The weekly winner takes the first promotion slot. The remaining promotion slots go to the highest average performances, and the lowest ranked players are demoted. Anyone with an average performance score of 0 is demoted, even if this would result in more demotions. You can not be promoted from league 1 and you can not be relegated from league 6.

When a player is demoted, their saved performance history is cleared and replaced with one 85% score for that week. Their next appearance in the lower league averages this 85% with their new performance.

## League 7

In league 7, a player is promoted to league 6 if they complete a seed under 25 minutes, or have a competition average time under 30 minutes. They must have played at least one seed. Not completing or not playing a seed counts as the time limit for the average. League 7 does not use rolling performance percentages.
