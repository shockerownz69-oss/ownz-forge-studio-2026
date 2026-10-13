export function memberVariable(source, pos) {
  const before = source.slice(0, pos);
  const match = before.match(/(?:^|[^A-Za-z_0-9])([A-Za-z_][A-Za-z_0-9]*)\.[A-Za-z_0-9]*$/);
  return match ? match[1] : null;
}
