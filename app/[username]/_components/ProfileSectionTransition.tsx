"use client";

import { useEffect, useState, type ReactNode } from "react";

type ProfileSectionTransitionProps = {
  sectionId: string;
  children: ReactNode;
};

export default function ProfileSectionTransition({ sectionId, children }: ProfileSectionTransitionProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(false);
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [sectionId]);

  return (
    <div
      className={`pt-2 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}
