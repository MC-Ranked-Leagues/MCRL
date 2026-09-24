import { fileURLToPath } from "node:url";

import {
  ApplicationIntegrationType,
  AttachmentBuilder,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";

import type { BotCommand } from "./command";

const steps = ["Profile1.png", "Profile2.png", "Profile3.png"];

export const linkCommand = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Show how to link Discord to your MCSR Ranked account.")
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    await interaction.editReply({
      content:
        "In the MCSR Ranked client, open Profile, then Settings, then Link Discord. Follow the screenshots below, then run /ranked to check your link.",
      files: steps.map(
        (filename, index) =>
          new AttachmentBuilder(
            fileURLToPath(
              new URL(`../../assets/link/${filename}`, import.meta.url)
            ),
            { name: `link_step${index + 1}.png` }
          )
      ),
    });
  },
} satisfies BotCommand;
