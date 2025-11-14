import "./globals.css";
import Navbar from "./components/Navbar";

export const metadata = {
  title: "ORYA",
  description: "A próxima fase da ORYA está a chegar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="bg-[#0a0a0f] text-white min-h-screen">
        <Navbar />
        {children}
      </body>
    </html>
  );
}