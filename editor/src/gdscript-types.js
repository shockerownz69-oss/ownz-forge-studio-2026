import {scanGDScript} from "./gdscript-scanner.js";

export function detectVariableTypes(source) {
  const types = new Map();
  const ambiguous = new Set();
  const pattern = /^[ \t]*(?:@onready[ \t]+|@export[ \t]+)*(?:var|const)[ \t]+([A-Za-z_]\w*)[ \t]*:[ \t]*([A-Za-z_]\w*)/gm;

  for (const match of source.matchAll(pattern)) {
    if (scanGDScript(source, match.index).string) continue;
    const [name, type] = [match[1], match[2]];
    if (ambiguous.has(name)) continue;
    if (types.has(name) && types.get(name) !== type) {
      types.delete(name);
      ambiguous.add(name);
    } else {
      types.set(name, type);
    }
  }
  return types;
}
