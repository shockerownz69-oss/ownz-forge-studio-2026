import {scanGDScript} from "./gdscript-scanner.js";

export function blockVisible(source, declarationPos, cursorPos) {
  if (declarationPos >= cursorPos) return false;

  const start = source.lastIndexOf("\n", declarationPos - 1) + 1;
  const end = source.indexOf("\n", start);
  const declarationLine = source.slice(
    start,
    end === -1 ? source.length : end
  );

  const indent = declarationLine.match(/^[ \t]*/)[0].length;

  if (indent === 0) return true;

  let lineStart = end === -1 ? source.length : end + 1;

  while (lineStart < cursorPos) {
    const nextNewline = source.indexOf("\n", lineStart);
    const lineEnd = nextNewline === -1
      ? source.length
      : nextNewline;

    const line = source.slice(lineStart, lineEnd);

    if (
      line.trim() &&
      !scanGDScript(source, lineStart).string &&
      !line.trimStart().startsWith("#")
    ) {
      const currentIndent = line.match(/^[ \t]*/)[0].length;

      if (currentIndent < indent) return false;
    }

    if (nextNewline === -1) break;
    lineStart = nextNewline + 1;
  }

  return true;
}
