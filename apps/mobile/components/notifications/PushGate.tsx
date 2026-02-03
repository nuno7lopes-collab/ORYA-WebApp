import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/auth";
import { registerForPushToken } from "../../lib/push";
import { api } from "../../lib/api";

export function PushGate() {
  const { session } = useAuth();
  const lastTokenRef = useRef<string | null>(null);
  const lastAccessTokenRef = useRef<string | null>(null);
  const authFailedRef = useRef(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (session?.access_token && session.access_token !== lastAccessTokenRef.current) {
      lastAccessTokenRef.current = session.access_token;
      authFailedRef.current = false;
    }
  }, [session?.access_token]);

  useEffect(() => {
    const register = async () => {
      if (!session?.user?.id || !session?.access_token || registering) return;
      if (authFailedRef.current) return;
      try {
        setRegistering(true);
        const token = await registerForPushToken();
        if (!token || lastTokenRef.current === token) return;
        await api.request("/api/me/push-tokens", {
          method: "POST",
          body: JSON.stringify({ token, platform: "ios" }),
        });
        lastTokenRef.current = token;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("API 401") || message.includes("UNAUTHENTICATED")) {
          authFailedRef.current = true;
        }
        console.warn("[mobile] push registration failed", err);
      } finally {
        setRegistering(false);
      }
    };

    register();
  }, [session?.user?.id, session?.access_token, registering]);

  return null;
}
