"use client";

import { useMemo, useRef, useState } from "react";
import { EventCoverCropModal } from "@/app/components/forms/EventCoverCropModal";
import {
  getEventCoverSuggestionIds,
  getEventCoverUrl,
  listEventCoverFallbacks,
  parseEventCoverToken,
} from "@/lib/eventCover";

type CoverCategory = "SUGESTOES" | "ALL" | string;

const COVER_PAGE_SIZE = 40;

type EventCoverLibraryPickerProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  organizationId?: number | null;
  templateType?: string | null;
  primaryModule?: string | null;
  title?: string;
  subtitle?: string;
};

export function EventCoverLibraryPicker({
  value,
  onChange,
  organizationId,
  templateType,
  primaryModule,
  title = "Capa",
  subtitle = "Abrir biblioteca de capas",
}: EventCoverLibraryPickerProps) {
  const [showModal, setShowModal] = useState(false);
  const [coverSearch, setCoverSearch] = useState("");
  const [coverCategory, setCoverCategory] = useState<CoverCategory>("SUGESTOES");
  const [coverPage, setCoverPage] = useState(1);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [coverCropFile, setCoverCropFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const coverLibrary = useMemo(() => listEventCoverFallbacks(), []);
  const coverSuggestions = useMemo(
    () => getEventCoverSuggestionIds({ templateType, primaryModule }),
    [templateType, primaryModule],
  );

  const suggestedCovers = useMemo(
    () =>
      coverSuggestions
        .map((id) => coverLibrary.find((cover) => cover.id === id))
        .filter((cover): cover is (typeof coverLibrary)[number] => Boolean(cover)),
    [coverSuggestions, coverLibrary],
  );

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    coverLibrary.forEach((item) => {
      if (item.category) categories.add(item.category);
    });
    return [
      { value: "SUGESTOES", label: "Sugestões" },
      { value: "ALL", label: "Todas" },
      ...Array.from(categories).map((category) => ({ value: category, label: category })),
    ];
  }, [coverLibrary]);

  const filteredCoverLibrary = useMemo(() => {
    const query = coverSearch.trim().toLowerCase();
    return coverLibrary.filter((cover) => {
      if (coverCategory === "SUGESTOES") return false;
      if (coverCategory !== "ALL" && cover.category !== coverCategory) return false;
      if (!query) return true;
      const labelMatch = cover.label.toLowerCase().includes(query);
      const tagMatch = (cover.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
      const scenarioMatch = cover.scenario?.toLowerCase().includes(query) ?? false;
      const businessMatch = cover.businessType?.toLowerCase().includes(query) ?? false;
      const categoryMatch = cover.category?.toLowerCase().includes(query) ?? false;
      return labelMatch || tagMatch || scenarioMatch || businessMatch || categoryMatch;
    });
  }, [coverCategory, coverLibrary, coverSearch]);

  const coverGridItems = coverCategory === "SUGESTOES" ? suggestedCovers : filteredCoverLibrary;
  const selectedCoverToken = parseEventCoverToken(value);
  const coverPreviewUrl = getEventCoverUrl(value, {
    seed: "padel-tournament-cover",
    suggestedIds: coverSuggestions,
    width: 960,
  });

  const pagedCovers = useMemo(
    () => coverGridItems.slice(0, coverPage * COVER_PAGE_SIZE),
    [coverGridItems, coverPage],
  );

  const canUpload = typeof organizationId === "number" && organizationId > 0;

  const handleCoverUpload = (file: File | null) => {
    if (!file) return;
    setError(null);
    setCoverCropFile(file);
    setShowCropModal(true);
  };

  const uploadCoverFile = async (file: File) => {
    if (!canUpload) {
      setError("Não foi possível carregar a capa para esta organização.");
      return;
    }
    setUploadingCover(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/upload?scope=event-cover&organizationId=${organizationId}`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        throw new Error(json?.error || "Falha no upload da capa.");
      }
      onChange(json.url as string);
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload da capa.");
    } finally {
      setUploadingCover(false);
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0] ?? null;
    handleCoverUpload(file);
  };

  return (
    <>
      <div className="rounded-xl border border-white/12 bg-white/[0.03] p-3">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/55">{title}</p>
          <button
            type="button"
            onClick={() => {
              setCoverCategory("SUGESTOES");
              setCoverPage(1);
              setShowModal(true);
            }}
            className="group relative w-full overflow-hidden rounded-xl border border-white/15 bg-black/20"
          >
            {coverPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreviewUrl} alt="Capa do torneio" className="aspect-square w-full object-cover" />
            ) : (
              <div className="aspect-square w-full bg-gradient-to-br from-[#0f111b] via-[#0a0b14] to-[#1f1a2d]" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-[12px] text-white/80 opacity-0 transition group-hover:opacity-100">
              Escolher capa
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCoverCategory("SUGESTOES");
              setCoverPage(1);
              setShowModal(true);
            }}
            className="text-left text-[11px] text-white/65 hover:text-white"
          >
            {subtitle}
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8">
          <div
            className="absolute inset-0"
            onClick={() => setShowModal(false)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-white/15 bg-[#070c18]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">Biblioteca de capas</p>
                <p className="text-sm text-white/80">Escolhe, pesquisa ou carrega uma imagem.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/75 hover:text-white"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div
                  onDrop={onDrop}
                  onDragOver={(event) => event.preventDefault()}
                  className="rounded-xl border border-dashed border-white/25 bg-black/30 p-3"
                >
                  <p className="text-[12px] text-white/80">Carregar imagem</p>
                  <p className="text-[11px] text-white/55">Arrasta aqui ou escolhe um ficheiro.</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!canUpload || uploadingCover}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
                    >
                      {uploadingCover ? "A carregar..." : "Escolher ficheiro"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(null)}
                      className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
                    >
                      Remover capa
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleCoverUpload(event.target.files?.[0] ?? null)}
                  />
                  {!canUpload ? <p className="mt-2 text-[11px] text-amber-200">Upload indisponível para esta organização.</p> : null}
                  {error ? <p className="mt-2 text-[11px] text-rose-200">{error}</p> : null}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-[11px] text-white/60">Pesquisa</p>
                  <input
                    value={coverSearch}
                    onChange={(event) => {
                      setCoverSearch(event.target.value);
                      setCoverPage(1);
                    }}
                    placeholder="Pesquisar capa"
                    className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[12px] text-white outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((option) => {
                    const active = coverCategory === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setCoverCategory(option.value);
                          setCoverPage(1);
                        }}
                        className={`rounded-full border px-3 py-1 text-[11px] ${
                          active
                            ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                            : "border-white/20 bg-white/[0.02] text-white/70"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-[11px] text-white/60">
                  <span>{coverGridItems.length} capas</span>
                  {selectedCoverToken ? <span>Selecionada: {selectedCoverToken}</span> : null}
                </div>

                {coverGridItems.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-[12px] text-white/60">
                    Sem resultados para esta pesquisa.
                  </div>
                ) : (
                  <div className="grid max-h-[62vh] grid-cols-2 gap-3 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-3 lg:grid-cols-4">
                    {pagedCovers.map((cover) => {
                      const selected = selectedCoverToken === cover.id;
                      return (
                        <button
                          key={cover.id}
                          type="button"
                          onClick={() => {
                            onChange(cover.token);
                            setShowModal(false);
                          }}
                          className={`group rounded-xl border text-left ${
                            selected
                              ? "border-cyan-300/65 bg-cyan-500/12"
                              : "border-white/12 bg-black/20 hover:border-white/30"
                          }`}
                        >
                          <div className="aspect-square overflow-hidden rounded-t-xl">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={cover.thumbUrl ?? cover.url} alt={cover.label} className="h-full w-full object-cover" />
                          </div>
                          <div className="p-2">
                            <p className="truncate text-[11px] text-white/80">{cover.label}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {coverGridItems.length > pagedCovers.length ? (
                  <button
                    type="button"
                    onClick={() => setCoverPage((prev) => prev + 1)}
                    className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/75 hover:bg-white/10"
                  >
                    Mostrar mais
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      <EventCoverCropModal
        open={showCropModal}
        file={coverCropFile}
        onCancel={() => {
          setShowCropModal(false);
          setCoverCropFile(null);
        }}
        onConfirm={async (file) => {
          setShowCropModal(false);
          setCoverCropFile(null);
          await uploadCoverFile(file);
        }}
      />
    </>
  );
}
