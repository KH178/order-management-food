import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FoodFlow – Order from the best restaurants",
  description: "Discover restaurants, order food, track delivery in real-time",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
