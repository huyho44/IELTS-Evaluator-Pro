import { safeReturn } from "./session";
export function courseBackDestination(returnTo: unknown) {
  const path = safeReturn(returnTo).split(/[?#]/)[0];
  const match =
    /^\/courses\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(?:lessons|practices)\/[0-9a-f-]+)?$/i.exec(
      path,
    );
  return match ? `/courses/${match[1]}` : "/courses";
}
