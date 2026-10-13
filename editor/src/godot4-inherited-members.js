import {godot4Types} from "./godot4-types.js";
import {godot4Parents} from "./godot4-inheritance.js";

export function inheritedMembers(type) {
  const members = new Set();
  const visited = new Set();
  while (type && !visited.has(type)) {
    visited.add(type);
    for (const member of godot4Types[type] || []) members.add(member);
    type = godot4Parents[type];
  }
  return [...members];
}
