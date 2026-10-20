/**
 * Fields, as the farmland is cut into them: the cells of a jittered lattice each going to its nearest point, so they
 * are a patchwork of uneven shapes. A part of the land shader, `landShader.ts`, that the crops' pass, `cropsShader.ts`,
 * cuts its fields by and the wet land's, `wetShader.ts`, its paddy's terraces.
 */
export const FIELDS_GLSL = `
// A field of the farmland: which cell of the lattice it is, its middle, and the middle of the field nearest it.
struct Field {
  ivec2 id;
  vec2 middle;
  vec2 next;
};

// The field a point of the ground is in, on a lattice of fields this many world units across: of the jittered points of
// the cells about it, the nearest, and the next.
Field fieldAt(vec2 world, float size) {
  ivec2 base = ivec2(floor(world / size));
  Field field = Field(base, vec2(1e9), vec2(1e9));
  float best = 1e18;
  float second = 1e18;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      ivec2 cell = base + ivec2(dx, dy);
      vec2 middle = (vec2(cell) + 0.15 + 0.7 * vec2(hash(cell, 41), hash(cell, 42))) * size;
      vec2 off = middle - world;
      float far = dot(off, off);
      if (far < best) {
        second = best;
        field.next = field.middle;
        best = far;
        field.id = cell;
        field.middle = middle;
      } else if (far < second) {
        second = far;
        field.next = middle;
      }
    }
  }
  return field;
}

// How far inside its field a point is, in world units: nought on the line halfway to the next field's middle.
float insideOf(Field field, vec2 world) {
  vec2 across = field.next - field.middle;
  return dot(field.middle + across * 0.5 - world, across / max(length(across), 1e-4));
}
`;
