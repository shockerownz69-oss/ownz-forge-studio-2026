import { activeFunctionHeader } from "./gdscript-scope.js";

export function parameterOptions(source, cursorPosition = source.length) {
  const active = activeFunctionHeader(source, cursorPosition);
  if (!active) return [];
  const names = active.parameters.split(",").map(p => p.trim().match(/^([A-Za-z_]\w*)/)?.[1]).filter(Boolean);
  return [...new Set(names)].map(label => ({label, type:"variable", detail:"Function parameter"}));
}
