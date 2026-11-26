import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kandokids — Painel",
  description: "Gestão de transporte escolar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-AO">
      <body>{children}</body>
    </html>
  );
}
