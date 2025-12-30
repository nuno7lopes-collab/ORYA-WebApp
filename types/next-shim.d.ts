import type { ForwardRefExoticComponent, RefAttributes, ComponentProps } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

declare module "next/navigation" {
  export function useRouter(): AppRouterInstance;
  export function redirect(url: string): never;
  export function useSearchParams(): URLSearchParams;
  export function usePathname(): string;
}

declare module "next/link" {
  type AnchorProps = ComponentProps<"a">;
  type LinkProps = {
    href: string;
    replace?: boolean;
    scroll?: boolean;
    prefetch?: boolean;
    shallow?: boolean;
    locale?: string | false;
  } & AnchorProps;

  const Link: ForwardRefExoticComponent<LinkProps & RefAttributes<HTMLAnchorElement>>;
  export default Link;
}
