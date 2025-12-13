"use client";

export function OrganizerTourTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("orya:startTour"))}
      className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
    >
      Ver tour
    </button>
  );
}
