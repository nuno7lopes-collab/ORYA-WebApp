"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import HomePopularCard from "@/app/components/home/HomePopularCard";

type CarouselItem = {
  key: string;
  href: string;
  imageUrl: string;
  title: string;
  location?: string | null;
  tagLabel?: string;
  metaLabel?: string | null;
};

type HomePopularCarouselProps = {
  items: CarouselItem[];
};

export default function HomePopularCarousel({ items }: HomePopularCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointerDownRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const dragRef = useRef(false);
  const dragMovedRef = useRef(false);
  const clickBlockRef = useRef(false);
  const pointerStartRef = useRef(0);
  const scrollStartRef = useRef(0);
  const hoverRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);
  const [isHovering, setIsHovering] = useState(false);

  const loopItems = useMemo(() => (items.length ? [...items, ...items] : []), [items]);

  useEffect(() => {
    hoverRef.current = isHovering;
  }, [isHovering]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      prefersReducedMotionRef.current = media.matches;
    };
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    const node = trackRef.current;
    if (!node || loopItems.length === 0) return;
    const speed = 0.03;
    let lastTime = performance.now();

    const step = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      if (!prefersReducedMotionRef.current && !hoverRef.current && !dragRef.current) {
        node.scrollLeft += delta * speed;
        const maxScroll = node.scrollWidth / 2;
        if (maxScroll > 0 && node.scrollLeft >= maxScroll) {
          node.scrollLeft -= maxScroll;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loopItems.length]);

  const normalizeScroll = () => {
    const node = trackRef.current;
    if (!node) return;
    const maxScroll = node.scrollWidth / 2;
    if (!maxScroll) return;
    if (node.scrollLeft < 0) node.scrollLeft += maxScroll;
    if (node.scrollLeft >= maxScroll) node.scrollLeft -= maxScroll;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const node = trackRef.current;
    if (!node) return;
    pointerDownRef.current = true;
    pointerIdRef.current = event.pointerId;
    dragRef.current = false;
    dragMovedRef.current = false;
    clickBlockRef.current = false;
    pointerStartRef.current = event.clientX;
    scrollStartRef.current = node.scrollLeft;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerDownRef.current) return;
    const node = trackRef.current;
    if (!node) return;
    const delta = event.clientX - pointerStartRef.current;
    const threshold = event.pointerType === "mouse" ? 6 : 10;
    if (!dragMovedRef.current) {
      if (Math.abs(delta) <= threshold) return;
      dragMovedRef.current = true;
      dragRef.current = true;
      clickBlockRef.current = true;
      node.setPointerCapture(event.pointerId);
    }
    if (!dragRef.current) return;
    node.scrollLeft = scrollStartRef.current - delta;
    normalizeScroll();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = trackRef.current;
    if (node && pointerIdRef.current !== null && node.hasPointerCapture(pointerIdRef.current)) {
      node.releasePointerCapture(pointerIdRef.current);
    }
    pointerDownRef.current = false;
    pointerIdRef.current = null;
    if (dragMovedRef.current) {
      window.setTimeout(() => {
        clickBlockRef.current = false;
      }, 150);
    } else {
      clickBlockRef.current = false;
    }
    dragRef.current = false;
    dragMovedRef.current = false;
  };

  if (!items.length) return null;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClickCapture={(event) => {
          if (clickBlockRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        className="orya-scrollbar-hide flex gap-5 overflow-x-auto pb-3 pt-2 md:pb-2 select-none touch-pan-x cursor-grab active:cursor-grabbing"
        style={{ touchAction: "pan-y" }}
      >
        {loopItems.map((item, index) => (
          <HomePopularCard
            key={`${item.key}-${index}`}
            href={item.href}
            imageUrl={item.imageUrl}
            title={item.title}
            location={item.location}
            tagLabel={item.tagLabel}
            metaLabel={item.metaLabel}
          />
        ))}
      </div>
    </div>
  );
}
