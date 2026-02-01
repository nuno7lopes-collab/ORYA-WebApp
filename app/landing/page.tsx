import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="landing-shell relative min-h-screen overflow-hidden text-white" data-landing-mirror="true">
      <div className="landing-flow" aria-hidden="true" />
      <div className="landing-glow" aria-hidden="true" />
      <div className="landing-vignette" aria-hidden="true" />

      <div className="landing-hero">
        <div className="landing-logo-wrap">
          <Image
            src="/brand/orya-logo.png"
            alt="Logo ORYA"
            width={360}
            height={360}
            priority
            fetchPriority="high"
            sizes="(max-width: 768px) 60vw, 360px"
            className="landing-logo"
          />
        </div>
        <h1 className="landing-name">ORYA</h1>
      </div>
    </div>
  );
}
