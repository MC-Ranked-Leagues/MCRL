export function formatPlayerName(player: {
  discordUserId: string;
  discordUsername: string;
  ign: string;
}): string {
  return player.discordUserId.startsWith("test:") ||
    player.discordUsername === player.ign
    ? player.ign
    : `${player.ign}(${player.discordUsername})`;
}
