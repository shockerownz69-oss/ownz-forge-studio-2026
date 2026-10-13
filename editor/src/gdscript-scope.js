export function activeFunctionHeader(source, pos) {
  const lines = source.slice(0, pos).split("\n");
  let active = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const indent = line.match(/^[ \t]*/)[0].length;
    const match = line.match(/^[ \t]*(?:static[ \t]+)?func[ \t]+\w+[ \t]*\(([^)]*)\)/);
    if (active && indent <= active.indent) active = null;
    if (match) active = {parameters: match[1], indent};
  }
  return active;
}
