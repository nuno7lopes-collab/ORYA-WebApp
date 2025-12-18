"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Breadcrumb({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <nav aria-label="breadcrumb" className={cn("flex items-center text-sm text-white/70", className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) {
  return <ol className={cn("flex items-center gap-2", className)} {...props} />;
}

export function BreadcrumbItem({ className, ...props }: React.LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn("inline-flex items-center gap-1 text-white/75", className)} {...props} />;
}

export function BreadcrumbSeparator({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span role="presentation" className={cn("text-white/40", className)} {...props}>
      /
    </span>
  );
}

export function BreadcrumbPage({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span aria-current="page" className={cn("font-semibold text-white", className)} {...props} />;
}
