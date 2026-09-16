/** Split Discord content at line breaks where possible, keeping player rows together. */
export function chunkMessage(content: string): string[] {
  const chunks: string[] = [];
  while (content.length > 2000) {
    const newline = content.lastIndexOf("\n", 2000);
    // A single long line, such as a list of missed players, still must fit Discord's limit.
    const end = newline > 0 ? newline : 2000;
    chunks.push(content.slice(0, end));
    content = content.slice(end + (newline > 0 ? 1 : 0));
  }
  if (content) chunks.push(content);
  return chunks;
}
