import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";
import { Navbar } from "./components/Navbar";
import { AuthModalProvider } from "./components/autenticação/AuthModalContext";
import AuthModal from "./components/autenticação/AuthModal";
import { RecoveryRedirector } from "./components/RecoveryRedirector";
import { BackgroundShell } from "./components/BackgroundShell";
import { AuthLinkInterceptor } from "./components/autenticação/AuthLinkInterceptor";
import { ThemeRuntime } from "./components/ThemeRuntime";
import { ClientSentryInit } from "./components/ClientSentryInit";

export const metadata: Metadata = {
  title: "ORYA",
  description: "O centro da tua vida social em Portugal.",
  manifest: "/manifest.json",
  themeColor: "#0f172a",
  appleWebApp: {
    capable: true,
    title: "ORYA",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/brand/orya-logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/orya-logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/orya-logo-180.png", sizes: "180x180", type: "image/png" }],
  },
};

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const host = (await headers()).get("host") ?? "";
  const isAdminHost = host.startsWith("admin.");

  return (
    <html
      lang="pt-PT"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="antialiased min-h-screen flex flex-col font-sans">
        <BackgroundShell>
          <ThemeRuntime />
          <ClientSentryInit />
          <AuthModalProvider>
            <AuthLinkInterceptor />
            {!isAdminHost && <Navbar />}
            <RecoveryRedirector />
            <main className="main-shell flex-1 transition-[padding] duration-200">
              {children}
            </main>
            <AuthModal />
          </AuthModalProvider>
        </BackgroundShell>
      </body>
    </html>
  );
}
