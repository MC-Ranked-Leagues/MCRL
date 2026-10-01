---
title: Using the League Bot
description: Commands for signing up, registering each week, and managing your account.
---

Use the League Bot in Discord to register for a week, check your account, or save
your Twitch username. If you're joining for the first time, start with the
[registration process](/registration/process/).

Arguments in square brackets are optional. For example, `/reg` registers you
without a stream, while `/reg streaming:true` includes your Twitch username.

## Your league and account

### `/link`

This shows you how to link Discord to your Minecraft account in the MCSR Ranked
client. Once you've linked them, use `/ranked` to check that the
bot finds the right account.

### `/ranked`

Check which MCSR Ranked account is linked to your Discord and see its profile.
You can use this before you've signed up for a league.

### `/signup`

Use this in `#league-signups` to ask for a league placement. The reviewer will
choose a league for you, and you'll get its Discord role once you're approved.

If you've already joined but your league role is missing, use `/signup` again
to restore it. You can also repeat it if your pending request didn't reach the
reviewer. If your signup was declined, ask a host to reconsider your placement.

### `/me`

See the Minecraft account and league the bot has saved for you, along with your
recent performance percentages. These are the scores used for
[promotions and demotions](/rules/relegations/).

## Registering and streaming

### `/reg [streaming]`

Use `/reg` in your league's chat channel to register for that week's competition.
Registration needs to be open, and you need exactly one league role matching the
channel. Check the reply to make sure you're registered. If your role is missing
or doesn't match, ask a host for help.

If you're streaming, use `/reg streaming:true`. The bot will include your saved
Twitch username in the host's registration export. If you haven't saved one,
it can use the Twitch connection on your Ranked profile. If neither is set,
use `/twitch` first. You need to opt in each week you register.

If the server uses a current week role, you'll get it when you register. The bot
removes it when you have no registrations left or the host ends the competition.

### `/unreg`

Use `/unreg` in your league's chat channel if you can't make it and
registration is open. You can't use it once registration closes or if you already
have results in an imported match.

If registration has closed, let a host know. If you don't play any seeds, you'll
be listed as missed below the standings and your performance history will stay
unchanged. Playing even one seed counts as participation, including a DNF.

### `/twitch username`

Save the Twitch channel you want to share with the hosts when you register to
stream. For example, `/twitch username:your_channel` saves `your_channel`. You can
also enter an `@handle` or a Twitch profile URL.

This remembers your username for future weeks. Use `/reg streaming:true` when
you want to include it in a week's registration.

## Changing your Minecraft account

### `/migrate_account`

If you're switching Minecraft accounts, link the new account to Discord on MCSR
Ranked, then use `/migrate_account`. Check the accounts in the bot's reply and
confirm within 60 seconds to send the request for host approval.

Your league stays the same when the host approves the change, but your saved
performance percentages are cleared. Previous competition results stay with
the old account. You can't migrate while registered in an active competition,
and the new account must not already belong to another player in the server.

If your request didn't reach the reviewer, run the command again to retry. To
request a different account while one is pending, ask the reviewer to deny the
first request. If you're approved but your league role is missing, use `/signup`
to restore it or ask a host for help.

## Checking the bot

### `/ping`

Use this to check whether the bot is responding.

Apart from `/signup`, `/reg`, and `/unreg`, these commands work in any server
channel.
