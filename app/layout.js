import "./globals.css";
import VisualFeedbackWidget from "./components/VisualFeedbackWidget";

export const metadata = {
  title: "Cloudflare API Dashboard",
  description: "Dashboard for monitoring and managing Cloudflare API Discovery",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
      >
        {children}
        <VisualFeedbackWidget />
      </body>
    </html>
  );
}
