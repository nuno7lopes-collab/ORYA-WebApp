import { ReactNode, CSSProperties } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { OrganizerLangSetter } from "./OrganizerLangSetter";
import { OrganizerBreadcrumb } from "./OrganizerBreadcrumb";

type OrganizerShellProps = {
  children: ReactNode;
  sidebar: ReactNode;
  organizerLanguage: string;
  organizerUsername?: string | null;
  brandPrimary?: string;
  brandSecondary?: string;
};

export function OrganizerShell({
  children,
  sidebar,
  organizerLanguage,
  organizerUsername,
  brandPrimary,
  brandSecondary,
}: OrganizerShellProps) {
  return (
    <SidebarProvider defaultOpen>
      <div
        className="orya-body-bg text-white flex min-h-screen items-stretch"
        style={
          {
            "--brand-primary": brandPrimary,
            "--brand-secondary": brandSecondary,
          } as CSSProperties
        }
      >
        <OrganizerLangSetter language={organizerLanguage} />
        {organizerUsername ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `try{sessionStorage.setItem("orya_last_organizer_username","${organizerUsername}");}catch(e){}`,
            }}
          />
        ) : null}

        {sidebar}

        <SidebarInset>
          <div className="sticky top-0 z-40 flex items-center gap-3 bg-[rgba(5,9,21,0.85)] px-4 py-3 backdrop-blur md:hidden">
            <SidebarTrigger />
            <OrganizerBreadcrumb />
          </div>
          <div className="hidden lg:block mb-4">
            <div className="rounded-3xl border border-white/5 bg-[rgba(6,10,20,0.75)] backdrop-blur-xl px-4 py-3 md:px-6 md:py-4">
              <OrganizerBreadcrumb />
            </div>
          </div>
          <main className="relative min-h-0 flex-1 overflow-y-auto pb-0 pt-0">
            <div className="px-4 py-4 md:px-6 lg:px-8 lg:py-6">
              <div className="relative isolate overflow-hidden">
                <div className="pointer-events-none absolute inset-0 -z-10">
                  <div className="absolute left-0 top-10 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,0,200,0.08),rgba(12,18,36,0))]" />
                  <div className="absolute right-0 bottom-16 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(107,255,255,0.10),rgba(5,9,21,0))]" />
                </div>
                {children}
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
