"use client";

const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

import React, { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [googleUrl, setGoogleUrl] = useState("");
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const url = `${BASE_URL}/auth/v1/authorize?provider=google&redirect_to=${window.location.origin}/auth/callback`;
      setGoogleUrl(url);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        body: formData,
      });

      // Garantimos que nunca rebenta se não vier JSON
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // se não for JSON, ignoramos e usamos só o status
      }

      if (!res.ok || (json && json.error)) {
        const msg =
          (json && json.error) ||
          `Erro no login (status ${res.status})`;
        setError(msg);
        return;
      }

      // Login OK -> vai para home (podes depois trocar para /dashboard, etc.)
      window.location.href = "/";
    } catch (err) {
      console.error(err);
      setError("Erro de rede. Tenta outra vez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 400,
        margin: "80px auto",
        color: "white",
        textAlign: "center",
      }}
    >
      <h1 style={{ marginBottom: 24 }}>Entrar</h1>

            {/* ... botão Entrar existente ... */}

      {error && (
        <p style={{ color: "orange", marginTop: 16 }}>
          {error}
        </p>
      )}

      <div
        style={{
          marginTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: 16,
        }}
      >
        <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
          Ou entra com:
        </p>

        {googleUrl && (
          <a
            href={googleUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: 14,
              textDecoration: "none",
              color: "white",
            }}
          >
            <span>G</span>
            <span>Continuar com Google</span>
          </a>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          style={{ padding: 10, borderRadius: 4 }}
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          style={{ padding: 10, borderRadius: 4 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "A entrar..." : "Entrar"}
        </button>
      </form>

      {error && (
        <p style={{ color: "orange", marginTop: 16 }}>
          {error}
        </p>
      )}
    </div>
  );
}