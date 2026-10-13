import {activeFunctionName} from "./gdscript-function-scope.js";

export function declarationScope(source, pos) {
  return activeFunctionName(source, pos) ?? "class";
}
