import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export interface BotCommand {
  data: Pick<SlashCommandBuilder, "name" | "toJSON">;
  execute(interaction: ChatInputCommandInteraction<"cached">): Promise<void>;
}
