import { z } from "zod";
import {
  BOUNDS_SIZE,
  MAX_VOXEL_COUNT,
} from "@/app/store/voxelConstraints";

// These are spec-level guardrails. They intentionally mirror the editor guardrails.
export const VOXEL_SPEC_MAX_DIMENSION = BOUNDS_SIZE;
export const VOXEL_SPEC_MAX_VOXELS = MAX_VOXEL_COUNT;

const int = z.number().int();

export const vec3Schema = z.object({
  x: int,
  y: int,
  z: int,
});

export type Vec3 = z.infer<typeof vec3Schema>;

// Bounds ----------------------------------------------------------------------

export const boundsSizeSchema = vec3Schema.superRefine((size, ctx) => {
  const dims: (keyof Vec3)[] = ["x", "y", "z"];
  for (const key of dims) {
    const v = size[key];
    if (v <= 0 || v > VOXEL_SPEC_MAX_DIMENSION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `size.${key} must be in 1..${VOXEL_SPEC_MAX_DIMENSION}`,
      });
    }
  }
});

export const boundsSchema = z.object({
  origin: vec3Schema.default({ x: 0, y: 0, z: 0 }),
  size: boundsSizeSchema,
});

export type VoxelBounds = z.infer<typeof boundsSchema>;

// Palette ---------------------------------------------------------------------

export const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "hex color like #RRGGBB");

export const paletteColorSchema = z.object({
  id: z.string().min(1),
  hex: hexColorSchema,
});

export const paletteSchema = z.object({
  name: z.string().min(1).optional(),
  colors: z.array(paletteColorSchema).max(256),
});

export type VoxelPalette = z.infer<typeof paletteSchema>;

// Color reference -------------------------------------------------------------

export const colorRefSchema = z.union([
  z.object({
    kind: z.literal("palette"),
    id: z.string().min(1),
  }),
  z.object({
    kind: z.literal("hex"),
    hex: hexColorSchema,
  }),
]);

export type VoxelColorRef = z.infer<typeof colorRefSchema>;

// Commands --------------------------------------------------------------------

export const boxCommandSchema = z
  .object({
    op: z.literal("box"),
    from: vec3Schema,
    to: vec3Schema,
    color: colorRefSchema,
  })
  .superRefine((cmd, ctx) => {
    const axes: (keyof Vec3)[] = ["x", "y", "z"];
    for (const axis of axes) {
      if (cmd.from[axis] > cmd.to[axis]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["from", axis],
          message: `"from.${axis}" must be <= "to.${axis}"`,
        });
      }
    }
  });

export const hollowBoxCommandSchema = z
  .object({
    op: z.literal("hollowBox"),
    from: vec3Schema,
    to: vec3Schema,
    thickness: int.min(1).max(4).default(1),
    color: colorRefSchema,
  })
  .superRefine((cmd, ctx) => {
    const axes: (keyof Vec3)[] = ["x", "y", "z"];
    for (const axis of axes) {
      if (cmd.from[axis] > cmd.to[axis]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["from", axis],
          message: `"from.${axis}" must be <= "to.${axis}"`,
        });
      }
    }
  });

export const floorCommandSchema = z.object({
  op: z.literal("floor"),
  y: int,
  color: colorRefSchema,
  area: z
    .object({
      from: z.object({ x: int, z: int }),
      to: z.object({ x: int, z: int }),
    })
    .superRefine((area, ctx) => {
      if (area.from.x > area.to.x) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["from", "x"],
          message: `"from.x" must be <= "to.x"`,
        });
      }
      if (area.from.z > area.to.z) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["from", "z"],
          message: `"from.z" must be <= "to.z"`,
        });
      }
    })
    .optional(),
});

export const lineCommandSchema = z.object({
  op: z.literal("line"),
  from: vec3Schema,
  to: vec3Schema,
  color: colorRefSchema,
  thickness: int.min(1).max(4).default(1),
});

export const commandSchema = z.union([
  boxCommandSchema,
  hollowBoxCommandSchema,
  floorCommandSchema,
  lineCommandSchema,
]);

export type VoxelCommand = z.infer<typeof commandSchema>;

// Metadata --------------------------------------------------------------------

export const metadataSchema = z.object({
  source: z.enum(["prompt", "code", "function"]).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  rawInput: z.string().optional(),
  seed: int.optional(),
});

// Base spec -------------------------------------------------------------------

export const voxelSpecBaseSchema = z.object({
  version: z.literal(1),
  bounds: boundsSchema,
  palette: paletteSchema.optional(),
  commands: z.array(commandSchema).min(1).max(1024),
  metadata: metadataSchema.optional(),
});

// --- Voxel estimation used for guardrails -----------------------------------

export function estimateCommandVoxels(
  cmd: VoxelCommand,
  bounds: VoxelBounds
): number {
  switch (cmd.op) {
    case "box": {
      const dx = cmd.to.x - cmd.from.x + 1;
      const dy = cmd.to.y - cmd.from.y + 1;
      const dz = cmd.to.z - cmd.from.z + 1;
      return Math.max(dx, 0) * Math.max(dy, 0) * Math.max(dz, 0);
    }
    case "hollowBox": {
      const dx = cmd.to.x - cmd.from.x + 1;
      const dy = cmd.to.y - cmd.from.y + 1;
      const dz = cmd.to.z - cmd.from.z + 1;
      if (dx <= 0 || dy <= 0 || dz <= 0) return 0;
      // Overestimates a bit but keeps the logic simple.
      return dx * dy * dz;
    }
    case "floor": {
      const width = bounds.size.x;
      const depth = bounds.size.z;
      if (!cmd.area) return width * depth;
      const dx = cmd.area.to.x - cmd.area.from.x + 1;
      const dz = cmd.area.to.z - cmd.area.from.z + 1;
      return Math.max(dx, 0) * Math.max(dz, 0);
    }
    case "line": {
      const dx = Math.abs(cmd.to.x - cmd.from.x);
      const dy = Math.abs(cmd.to.y - cmd.from.y);
      const dz = Math.abs(cmd.to.z - cmd.from.z);
      const len = Math.max(dx, dy, dz) + 1;
      return len * cmd.thickness * cmd.thickness;
    }
    default: {
      // Exhaustive guard.
      const _never: never = cmd;
      return _never;
    }
  }
}

export const voxelSpecSchema = voxelSpecBaseSchema.superRefine((spec, ctx) => {
  const est = spec.commands.reduce(
    (sum, cmd) => sum + estimateCommandVoxels(cmd as VoxelCommand, spec.bounds),
    0
  );
  if (est > VOXEL_SPEC_MAX_VOXELS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["commands"],
      message: `Estimated voxel count ${est} exceeds cap of ${VOXEL_SPEC_MAX_VOXELS}`,
    });
  }
});

export type VoxelSpec = z.infer<typeof voxelSpecSchema>;


