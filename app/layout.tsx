import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "./components/Navbar";
import { AuthModalProvider } from "./components/autenticação/AuthModalContext";
import AuthModal from "./components/autenticação/AuthModal";
import { RecoveryRedirector } from "./components/RecoveryRedirector";
import { BackgroundShell } from "./components/BackgroundShell";
import { AuthLinkInterceptor } from "./components/autenticação/AuthLinkInterceptor";

export const metadata: Metadata = {
  title: "ORYA",
  description: "O centro da tua vida social em Portugal.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT" className="h-full" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col font-sans">
        <BackgroundShell>
          <AuthModalProvider>
            <AuthLinkInterceptor />
            <Navbar />
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
