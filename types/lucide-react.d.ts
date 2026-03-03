declare module "lucide-react" {
  import * as React from "react";

  export interface LucideIconProps extends React.SVGProps<SVGSVGElement> {}
  export type LucideIcon = React.FC<LucideIconProps>;

  export const Pencil: LucideIcon;
  export const Move3D: LucideIcon;
  export const Layers: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Trash2: LucideIcon;
  export const Wrench: LucideIcon;
}


