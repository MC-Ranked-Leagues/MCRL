// name or UUID.
export function headUrl(player: string) {
  return `https://vzge.me/face/128/${encodeURIComponent(player)}.png`;
}

export const STEVE_HEAD = headUrl("Steve");
