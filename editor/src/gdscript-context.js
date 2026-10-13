import {scanGDScript} from "./gdscript-scanner.js";

export function completionContext(source, pos) {
  const state = scanGDScript(source, pos);
  const line = source.slice(0, pos).split("\n").pop();
  const member = !state.comment && !state.string && /[A-Za-z_][A-Za-z_0-9]*\.[A-Za-z_0-9]*$/.test(line);
  return {...state, member};
}
