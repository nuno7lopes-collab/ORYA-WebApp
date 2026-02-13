export function shouldHideUserNavbar(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === "/org" ||
    pathname.startsWith("/org/") ||
    pathname === "/org-hub" ||
    pathname.startsWith("/org-hub/") ||
    pathname.startsWith("/landing")
  );
}
