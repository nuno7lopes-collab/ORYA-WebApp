import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { Navbar } from "./components/Navbar";
import { CheckoutProvider } from "@/app/components/checkout/contextoCheckout";
import ModalCheckout from "@/app/components/checkout/ModalCheckout";
import { AuthModalProvider } from "./components/autenticação/AuthModalContext";
import AuthModal from "./components/autenticação/AuthModal";

const inter = Inter({ subsets: ["latin"] });

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
      <body
        className={`${inter.className} orya-body-bg antialiased min-h-screen flex flex-col`}
      >
        <AuthModalProvider>
          <CheckoutProvider>
            <Navbar />
            <main className="flex-1 pt-16 md:pt-20">
              {children}
            </main>
            <ModalCheckout />
          </CheckoutProvider>
          <AuthModal />
        </AuthModalProvider>
      </body>
    </html>
  );
}