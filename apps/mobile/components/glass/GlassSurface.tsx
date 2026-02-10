import type { ComponentProps } from "react";
import { GlassSurface as BaseGlassSurface } from "../ui/GlassSurface";

export type { GlassSurfaceProps } from "../ui/GlassSurface";

export function GlassSurface(props: ComponentProps<typeof BaseGlassSurface>) {
  return <BaseGlassSurface variant="surface" {...props} />;
}
