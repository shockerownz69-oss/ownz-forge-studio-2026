export function scanGDScript(source, pos) {
  const text = source.slice(0, pos);
  let quote = null, triple = false, escaped = false, comment = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") { comment = false; if (!triple) quote = null; escaped = false; i++; continue; }
    if (comment) { i++; continue; }
    if (escaped) { escaped = false; i++; continue; }
    if (quote && ch === "\\") { escaped = true; i++; continue; }
    if (quote && triple && text.slice(i,i+3) === quote.repeat(3)) { quote = null; triple = false; i += 3; continue; }
    if (quote && !triple && ch === quote) { quote = null; i++; continue; }
    if (!quote && (ch === "\"" || ch === "\u0027")) {
      quote = ch; triple = text.slice(i,i+3) === ch.repeat(3);
      i += triple ? 3 : 1; continue;
    }
    if (!quote && ch === "#") { comment = true; i++; continue; }
    i++;
  }
  return {comment, string: quote !== null};
}
