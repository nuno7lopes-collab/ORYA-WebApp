import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { Navbar } from "./components/Navbar";

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
    <html lang="pt" className="h-full">
      <body
        className={`${inter.className} orya-body-bg antialiased min-h-screen flex flex-col`}
      >
        <Navbar />
        <main className="flex-1 pt-16 md:pt-20">
          {children}
        </main>
      </body>
    </html>
  );
}