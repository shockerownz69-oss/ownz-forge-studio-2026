import {scanGDScript} from "./gdscript-scanner.js";
export function functionScopeId(source, pos) {
  const prefix = source.slice(0, pos);
  const lines = prefix.split("\n");
  let active = null;
  let offset = 0;

  for (const line of lines) {
    if (!line.trim() || scanGDScript(source, offset).string || line.trimStart().startsWith("#")) {
      offset += line.length + 1;
      continue;
    }

    const indent = line.match(/^[ \t]*/)[0].length;
    const match = line.match(/^[ \t]*(?:static[ \t]+)?func[ \t]+[A-Za-z_]\w*[ \t]*\(/);

    if (active && indent <= active.indent) active = null;
    if (match) active = {id: offset, indent};

    offset += line.length + 1;
  }

  return active?.id ?? null;
}
