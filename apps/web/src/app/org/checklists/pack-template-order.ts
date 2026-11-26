type TemplateMoveDirection = -1 | 1;

export function toggleTemplateId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

export function moveTemplateId(
  ids: number[],
  id: number,
  direction: TemplateMoveDirection,
): number[] {
  const index = ids.indexOf(id);
  if (index < 0) return ids;
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= ids.length) return ids;
  const next = [...ids];
  const [moved] = next.splice(index, 1);
  next.splice(nextIndex, 0, moved);
  return next;
}
