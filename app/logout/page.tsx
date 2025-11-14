"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function Logout() {
  useEffect(() => {
    supabaseBrowser.auth.signOut().then(() => {
      window.location.href = "/";
    });
  }, []);

  return <p>Logging out...</p>;
}