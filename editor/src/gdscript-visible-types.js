import {scanGDScript} from "./gdscript-scanner.js";
import {functionScopeId} from "./gdscript-scope-id.js";
import {blockVisible} from "./gdscript-block-visibility.js";

export function visibleVariableTypes(source, pos) {
  const classTypes = new Map();
  const localTypes = new Map();
  const classAmbiguous = new Set();
  const localAmbiguous = new Set();
  const currentScope = functionScopeId(source, pos);
  const pattern = /^[ \t]*(?:@onready[ \t]+|@export[ \t]+)*(?:var|const)[ \t]+([A-Za-z_]\w*)[ \t]*:[ \t]*([A-Za-z_]\w*)/gm;

  for (const match of source.matchAll(pattern)) {
    if (match.index >= pos) break;
    if (scanGDScript(source, match.index).string) continue;

    const scope = functionScopeId(source, match.index);
    if (scope !== null && scope !== currentScope) continue;
    if (!blockVisible(source, match.index, pos)) continue;

    const name = match[1];
    const type = match[2];

    const target = scope === null ? classTypes : localTypes;
    const ambiguous = scope === null ? classAmbiguous : localAmbiguous;
    if (ambiguous.has(name)) continue;
    if (target.has(name) && target.get(name) !== type) {
      target.delete(name);
      ambiguous.add(name);
    } else {
      target.set(name, type);
    }
  }

  const visible = new Map(classTypes);
  for (const name of localAmbiguous) visible.delete(name);
  for (const [name, type] of localTypes) visible.set(name, type);
  return visible;
}
