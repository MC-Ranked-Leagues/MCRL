import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  escapeMarkdown,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
  type Client,
  type Message,
} from "discord.js";
import { guildConfiguration } from "../../config/guilds";
import {
  createSignup,
  decideSignup,
  getPlayer,
  getPlayerById,
  saveSignupMessage,
} from "../db/players";
import { getMemberLeagues, syncLeagueRole } from "../lib/league-roles";
import { ranked, rankedLookupErrorMessage } from "../lib/ranked";
import { formatDuration } from "../lib/time";
import type { BotCommand } from "./command";

// The upstream Elo suggestion informs the reviewer; it does not assign a league.
const leagueTargets = [
  [7, 0],
  [6, 766.1],
  [5, 1050.3],
  [4, 1215],
  [3, 1405.7],
  [2, 1588.2],
  [1, 1967.7],
] as const;

function signupButtons(
  player: NonNullable<ReturnType<typeof getPlayer>>,
  selectedLeague?: number
) {
  const buttons =
    selectedLeague === undefined
      ? Object.keys(guildConfiguration[player.guildId]!.leagues).map((league) =>
          new ButtonBuilder()
            .setCustomId(`signup:pick:${player.id}:${league}`)
            .setLabel(`League ${league}`)
            .setStyle(ButtonStyle.Primary)
        )
      : [
          new ButtonBuilder()
            .setCustomId(`signup:approve:${player.id}:${selectedLeague}`)
            .setLabel(`Confirm League ${selectedLeague}`)
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`signup:back:${player.id}`)
            .setLabel("Back")
            .setStyle(ButtonStyle.Secondary),
        ];
  buttons.push(
    new ButtonBuilder()
      .setCustomId(`signup:deny:${player.id}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger)
  );
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5)
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        buttons.slice(i, i + 5)
      )
    );
  return rows;
}

async function sendSignupReview(
  client: Client,
  player: NonNullable<ReturnType<typeof getPlayer>>
) {
  const reviewer = await client.users.fetch(
    guildConfiguration[player.guildId]!.signup!.reviewerId
  );
  const channel = await reviewer.createDM();
  const content = `Signup for **${escapeMarkdown(player.discordUsername)}**\nMinecraft: **${escapeMarkdown(player.ign)}**\n${player.signupDetails ?? ""}`;
  const previous = player.signupMessageId
    ? await channel.messages.fetch(player.signupMessageId).catch(() => null)
    : null;
  const payload = {
    content,
    components: signupButtons(player),
    allowedMentions: { parse: [] as never[] },
  };
  const message = previous
    ? await previous.edit(payload)
    : await channel.send(payload);
  saveSignupMessage(player.id, message.id);
}

export const signupCommand = {
  data: new SlashCommandBuilder()
    .setName("signup")
    .setDescription(
      "Sign up for ranked leagues or restore your saved league role."
    )
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    const config = guildConfiguration[interaction.guildId];
    if (!config?.signup) {
      await interaction.editReply(
        "Signup review is not configured for this server."
      );
      return;
    }
    if (interaction.channelId !== config.signup.channelId) {
      await interaction.editReply(
        `Use /signup in <#${config.signup.channelId}>.`
      );
      return;
    }
    let player = getPlayer(interaction.guildId, interaction.user.id);
    if (player?.status === "active") {
      if (player.leagueNumber === null) {
        await interaction.editReply(
          "Something went wrong! Ask a host to assign your league with /assign."
        );
        return;
      }
      try {
        await syncLeagueRole(
          interaction.guild,
          config,
          interaction.user.id,
          player.leagueNumber,
          "Restoring saved league"
        );
        await interaction.editReply(
          `Restored your League ${player.leagueNumber} role.`
        );
      } catch (error) {
        console.error("Could not restore league role.", error);
        await interaction.editReply(
          "Your membership is saved, but the role could not be restored. Ask a host to check role permissions, then retry."
        );
      }
      return;
    }
    if (player?.status === "rejected") {
      await interaction.editReply(
        "Your signup was declined. If you believe this was a mistake, contact a host to reconsider your placement."
      );
      return;
    }
    if (!player) {
      if (
        (await getMemberLeagues(interaction.guild, config, interaction.user.id))
          .length
      ) {
        await interaction.editReply("You already have a league role.");
        return;
      }
      let profile;
      try {
        profile = await ranked.users.get(`discord.${interaction.user.id}`);
      } catch (error) {
        await interaction.editReply(rankedLookupErrorMessage(error));
        return;
      }
      const peak = profile.seasonResult.highest;
      const targets = leagueTargets.filter(
        ([league]) => config.leagues[league]
      );
      const suggested =
        peak === null || targets.length === 0
          ? undefined
          : targets.reduce((best, candidate) =>
              Math.abs(candidate[1] - peak) < Math.abs(best[1] - peak)
                ? candidate
                : best
            )[0];
      const season = profile.statistics.season;
      const completions = season.completions.ranked ?? 0;
      const average =
        completions > 0 && season.completionTime.ranked !== null
          ? season.completionTime.ranked / completions
          : null;
      const details = `Current Elo: ${profile.eloRate ?? "n/a"}\nPeak Elo: ${peak ?? "n/a"}\nSuggested league: ${suggested ?? "n/a"}\nRanked average: ${average === null ? "n/a" : formatDuration(average)}\nRanked PB: ${season.bestTime.ranked == null ? "n/a" : formatDuration(season.bestTime.ranked)}\nProfile: <https://mcsrranked.com/profile/${profile.uuid}>`;
      player = createSignup({
        guildId: interaction.guildId,
        discordUserId: interaction.user.id,
        discordUsername: interaction.user.username,
        minecraftUuid: profile.uuid,
        ign: profile.nickname,
        signupDetails: details,
      });
      if (!player) {
        await interaction.editReply(
          "This Minecraft account already belongs to another player."
        );
        return;
      }
      if (player.status !== "pending") {
        await interaction.editReply(
          "Your membership status changed. Try running /signup again."
        );
        return;
      }
    }
    try {
      await sendSignupReview(interaction.client, player);
      await interaction.editReply(
        "Your signup is pending review. The reviewer has your request."
      );
    } catch (error) {
      console.error("Could not deliver signup review.", error);
      await interaction.editReply(
        "Your signup is saved, but the reviewer could not be reached. Notify a host or admin."
      );
    }
  },
} satisfies BotCommand;

export async function handleSignupReview(interaction: ButtonInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const [, action, id, selectedLeague] = interaction.customId.split(":");
  const player = getPlayerById(Number(id));
  const config = player && guildConfiguration[player.guildId];
  if (
    !player ||
    !config?.signup ||
    interaction.user.id !== config.signup.reviewerId ||
    player.signupMessageId !== interaction.message.id
  ) {
    await interaction.editReply(
      "This signup is unavailable or you are not its reviewer."
    );
    return;
  }
  if (player.status !== "pending") {
    await interaction.editReply(`This player is already ${player.status}.`);
    return;
  }
  const league = Number(selectedLeague);
  if ((action === "pick" || action === "approve") && !config.leagues[league]) {
    await interaction.editReply("That league is not configured.");
    return;
  }
  if (action === "pick" || action === "back") {
    await interaction.message.edit({
      components: signupButtons(player, action === "pick" ? league : undefined),
    });
    await interaction.editReply(
      action === "pick"
        ? `Confirm League ${league} using the review buttons.`
        : "Choose a league."
    );
    return;
  }
  if (action !== "approve" && action !== "deny") {
    await interaction.editReply("Unknown signup action.");
    return;
  }
  const guild = await interaction.client.guilds.fetch(player.guildId);
  const profile =
    action === "approve"
      ? await ranked.users.get(`discord.${player.discordUserId}`)
      : undefined;
  const result = decideSignup(
    player.id,
    action === "approve" ? league : undefined,
    profile?.uuid
  );
  if (result === "link_changed" || result === "resolved") {
    await interaction.editReply(
      result === "link_changed"
        ? "The linked account changed. Ask the player to restore the account used for signup before approval."
        : "This signup is already resolved."
    );
    return;
  }
  let outcome = `Signup ${result}.`;
  if (result === "approved") {
    try {
      await syncLeagueRole(
        guild,
        config,
        player.discordUserId,
        league,
        `Signup approved by ${interaction.user.id}`
      );
    } catch (error) {
      console.error("Signup saved but roles failed.", error);
      outcome +=
        " Membership is saved. Retry the role update with /assign or /signup.";
    }
  }
  await interaction.editReply(outcome);
  await interaction.message.edit({
    content: `${interaction.message.content}\n\n${outcome}`,
    components: [],
  });
  const applicant = await interaction.client.users.fetch(player.discordUserId);
  await applicant
    .send(
      result === "approved"
        ? `Welcome to Ranked Leagues! You have been placed in League ${league}. Make sure to read the server's league information. .`
        : "Your league signup was declined. If you believe this was a mistake, contact an admin."
    )
    .catch((error: unknown) =>
      console.error("Could not notify signup applicant.", error)
    );
}

export async function moderateSignupChannel(message: Message) {
  if (!message.guild || message.author.bot) return;
  const config = guildConfiguration[message.guild.id];
  if (!config?.signup || message.channelId !== config.signup.channelId) return;
  const member = await message.guild.members.fetch({
    user: message.author.id,
    force: true,
  });
  if (!member.roles.cache.has(config.commandRoleId)) await message.delete();
}
