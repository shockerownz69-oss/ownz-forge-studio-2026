import {detectVariableTypes} from "./gdscript-types.js";
import {godot4Types} from "./godot4-types.js";
import {inheritedMembers} from "./godot4-inherited-members.js";

export function resolveMemberType(source, variableName) {
  const type = detectVariableTypes(source).get(variableName);
  if (!type || !Object.hasOwn(godot4Types, type)) return null;
  return {type, members: inheritedMembers(type)};
}
