export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-white">
      <div className="orya-page-width px-4 md:px-8 py-16 md:py-20">
        {children}
      </div>
    </div>
  );
}
