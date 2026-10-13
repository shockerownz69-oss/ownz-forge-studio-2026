export const godot4Types = {
  Object: ["get_class", "is_class", "get_instance_id", "get", "set", "call"],
  Node: ["queue_free", "get_node", "add_child", "remove_child", "get_parent", "get_tree"],
  CanvasItem: ["show", "hide", "is_visible_in_tree", "queue_redraw"],
  Node2D: ["position", "global_position", "rotation", "scale", "look_at"],

  CharacterBody2D: ["move_and_slide", "is_on_floor", "is_on_wall", "is_on_ceiling", "velocity", "floor_snap_length"],
  Camera2D: ["make_current", "is_current", "reset_smoothing", "get_screen_center_position", "zoom", "offset", "enabled"],
  Sprite2D: ["texture", "frame", "frame_coords", "hframes", "vframes", "flip_h", "flip_v"]
};
