"use client";

type AuthGateBannerProps = {
  title: string;
  description: string;
};

export default function AuthGateBanner({ title, description }: AuthGateBannerProps) {
  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-[11px] text-amber-50">
      <p className="font-semibold">{title}</p>
      <p className="text-amber-100/80">{description}</p>
    </div>
  );
}
