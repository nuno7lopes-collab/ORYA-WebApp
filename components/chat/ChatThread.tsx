"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";

const THREAD_SCHEMA = "app_v3" as const;
const MESSAGE_LIMIT = 50;

type ThreadStatus = "ANNOUNCEMENTS" | "OPEN" | "READ_ONLY" | "CLOSED";

type ThreadRow = {
  id: string;
  status: ThreadStatus;
  open_at: string;
  read_only_at: string;
  close_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  user_id: string | null;
  kind: "USER" | "ANNOUNCEMENT" | "SYSTEM";
  body: string;
  created_at: string;
  deleted_at: string | null;
};

type ChatThreadProps = {
  entityType: "EVENT" | "BOOKING";
  entityId: number;
  canPostAnnouncements?: boolean;
};

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function resolveStatusLabel(status: ThreadStatus) {
  if (status === "ANNOUNCEMENTS") return "Anuncios do organizador";
  if (status === "OPEN") return "Chat ao vivo";
  if (status === "READ_ONLY") return "Chat em leitura";
  return "Chat fechado";
}

export default function ChatThread({ entityType, entityId, canPostAnnouncements }: ChatThreadProps) {
  const { isLoggedIn, user } = useUser();
  const { openModal } = useAuthModal();
  const [thread, setThread] = useState<ThreadRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    if (!thread) return false;
    if (thread.status === "OPEN") return true;
    if (thread.status === "ANNOUNCEMENTS") return Boolean(canPostAnnouncements);
    return false;
  }, [thread, canPostAnnouncements]);

  const statusLabel = thread ? resolveStatusLabel(thread.status) : null;

  const loadThread = async (opts?: { silent?: boolean }) => {
    if (!isLoggedIn) return;
    if (!opts?.silent) setLoading(true);
    setError(null);

    const client = supabaseBrowser.schema(THREAD_SCHEMA);
    const { data, error: threadError } = await client
      .from("chat_threads")
      .select("id,status,open_at,read_only_at,close_at")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .maybeSingle();

    if (threadError || !data) {
      setThread(null);
      setMessages([]);
      setLoading(false);
      setError("Chat indisponivel para este acesso.");
      return;
    }

    const nextThread = data as ThreadRow;
    setThread(nextThread);

    const { data: messageRows, error: messageError } = await client
      .from("chat_messages")
      .select("id,thread_id,user_id,kind,body,created_at,deleted_at")
      .eq("thread_id", nextThread.id)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_LIMIT);

    if (messageError) {
      setMessages([]);
    } else {
      const ordered = (messageRows as MessageRow[] | null) ?? [];
      setMessages(ordered.slice().reverse());
    }

    if (!opts?.silent) setLoading(false);
  };

  useEffect(() => {
    void loadThread();
  }, [entityType, entityId, isLoggedIn]);

  useEffect(() => {
    if (!thread?.id) return;

    const channel = supabaseBrowser.channel(`chat:${thread.id}`);
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: THREAD_SCHEMA,
          table: "chat_messages",
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          const record = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.some((item) => item.id === record.id)) return prev;
            return [...prev, record];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: THREAD_SCHEMA,
          table: "chat_messages",
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          const record = payload.new as MessageRow;
          setMessages((prev) => prev.map((item) => (item.id === record.id ? record : item)));
        },
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [thread?.id]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!thread?.id) return;
    const interval = setInterval(() => {
      void loadThread({ silent: true });
    }, 60000);
    return () => clearInterval(interval);
  }, [thread?.id]);

  const handleLogin = () => {
    const redirectTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    openModal({ mode: "login", redirectTo });
  };

  const sendMessage = async () => {
    if (!thread || !canSend || sending) return;
    const body = input.trim();
    if (!body) return;

    setSending(true);
    setError(null);

    const kind = thread.status === "ANNOUNCEMENTS" && canPostAnnouncements ? "ANNOUNCEMENT" : "USER";
    const { error: insertError } = await supabaseBrowser
      .schema(THREAD_SCHEMA)
      .from("chat_messages")
      .insert({ thread_id: thread.id, user_id: user?.id ?? null, body, kind });

    if (insertError) {
      setError("Nao foi possivel enviar a mensagem.");
    } else {
      setInput("");
    }

    setSending(false);
  };

  if (!isLoggedIn) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
        <p>Inicia sessao para veres o chat.</p>
        <button
          type="button"
          onClick={handleLogin}
          className="mt-3 rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:border-white/40"
        >
          Entrar
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">A carregar chat...</div>;
  }

  if (!thread) {
    return <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">{error ?? "Chat indisponivel."}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">{statusLabel}</p>
        {thread.status === "READ_ONLY" && (
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">
            Leitura
          </span>
        )}
      </div>

      <div
        ref={listRef}
        className="max-h-[320px] space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-3 text-sm text-white/80"
      >
        {messages.length === 0 && (
          <p className="text-sm text-white/60">Ainda nao ha mensagens.</p>
        )}
        {messages.map((message) => {
          const isMine = message.user_id && message.user_id === user?.id;
          const deleted = Boolean(message.deleted_at);
          const label = message.kind === "ANNOUNCEMENT" ? "Organizador" : isMine ? "Tu" : "Participante";
          return (
            <div key={message.id} className={`rounded-xl border px-3 py-2 ${message.kind === "ANNOUNCEMENT" ? "border-cyan-400/30 bg-cyan-500/10" : "border-white/10 bg-white/5"}`}>
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span className="uppercase tracking-[0.2em]">{label}</span>
                <span>{formatTime(message.created_at)}</span>
              </div>
              <p className={`mt-1 text-sm ${deleted ? "text-white/40" : "text-white/80"}`}>
                {deleted ? "Mensagem removida." : message.body}
              </p>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
        <textarea
          rows={2}
          value={input}
          maxLength={500}
          onChange={(event) => setInput(event.target.value)}
          disabled={!canSend || sending}
          placeholder={
            thread.status === "ANNOUNCEMENTS"
              ? canPostAnnouncements
                ? "Escreve um anuncio para os participantes"
                : "Apenas o organizador pode publicar anuncios"
              : thread.status === "OPEN"
                ? "Escreve a tua mensagem"
                : "O chat esta em modo leitura"
          }
          className="w-full resize-none rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40 disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-white/50">{input.length}/500</span>
          <button
            type="button"
            disabled={!canSend || sending || input.trim().length === 0}
            onClick={sendMessage}
            className="rounded-full border border-white/20 px-4 py-1.5 text-[11px] text-white/80 hover:border-white/40 disabled:opacity-60"
          >
            {sending ? "A enviar..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
