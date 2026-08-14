---
title: League Bot Commands
description: A list of all MCRL bot commands.
---

This bot is mostly created to simplify the work of the hosts and admins. However it also handles some important and not that important player related commands.

## Functionality

This bot requires specific roles in order to categorize people who call commands. Players should have the role “League X” with X being the number (1-7). Any player without the proper League X role (for example, a League 2 player attempting to call a command in a League 1 competition) will be denied access.

## Commands

Format:
`Command [parameter1][parameter2][...] - explanation`
Use case: xyz

THESE COMMANDS WILL ONLY WORK IN YOUR LEAGUE CHANNEL (so if you’re league 3 use it in #league-3)! DO NOT USE THEM ANYWHERE ELSE.

`/help` - Outputs a document with all the commands and their explanations
Use Case: Use this document as reference for any questions on how commands work

`/reg` - Players will use this to register for the event. Only works if the player’s minecraft account is connected to their discord.
Use Case: To register for this week’s matches. You must register to play!

`/link` - Displays info on how to link MCSR account to discord
Use Case: If it’s not connected already

`/unreg` - Players will use this to unregister for the event. They may not unregister after registration is turned off (so they will need to contact an admin)
Use Case: To unregister

## Score Related Commands

`/lb` - Displays the leaderboard which shows rankings, total points, and average time. Players are split by dashes to show who is at risk of demotion, who may be promoted, and who stays in the current league. Also shows status, if the competition is ongoing or not.
Use Case: Shows information about the match.

`/s[seed]` - Shows standings for the seed, which includes rankings, time, and points gained.

`/stats[user]` - Displays the points, average, number of dnfs, and placements for every seed for a user as well as their times for the current week. If the parameter is left blank, it defaults to you. Does not display cumulative week results, only the week of the current match. For cumulative results, use this website.
Use Case: Displays your stats for the competition

## Disclaimer

The League Bot is a bot designed to streamline the creation of league matches, the calculation of scores for league matches, and the promotion/demotion process with the use of simple commands. It has been tested quite a bit, but it is still in beta, so please DM `releasethelist` with anything that goes wrong with the bot. Also note that we are not the best at creating command names or command descriptions, so if anything is unclear or if any commands should be changed to a different command/wording for clarity, please let us know.

We are aware that the outputs are very basic. We are not graphic designers, and so we do not have the capability to make it look better :( (we know ai slop would be worse).

More info on the bot can be found in the [League Bot documentation](https://docs.google.com/document/d/10FpS0hHeqo5yKgIweX31PNr7h_uAD5Cm6kvbmeH4iwI/edit?tab=t.0).
