export function normalizeTwitchUsername(input: string): string | null {
  let username = input.trim();

  if (/^(?:https?:\/\/|(?:www\.|m\.)?twitch\.tv\/)/i.test(username)) {
    try {
      const url = new URL(
        /^https?:\/\//i.test(username) ? username : `https://${username}`
      );
      if (
        !["twitch.tv", "www.twitch.tv", "m.twitch.tv"].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.port
      ) {
        return null;
      }
      const path = url.pathname.match(/^\/([a-z0-9_]+)\/?$/i);
      if (!path) return null;
      username = path[1]!;
    } catch {
      return null;
    }
  } else {
    username = username.replace(/^@/, "");
  }

  // Existing accounts can have names shorter than today's signup minimum.
  return /^[a-z0-9_]{1,25}$/i.test(username) ? username.toLowerCase() : null;
}
