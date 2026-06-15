import './globals.css';

export const metadata = {
  title: 'Trifecta Platform — Operator Console',
  description:
    'Marketing Mix Modelling as a managed service. Operator console for configuring, training and explaining Bayesian MMM (Google Meridian) models across a portfolio of clients.',
};

// Device-width so the CMO Signal surface is mobile-first (CMOs open it on a phone).
// The operator console is still a wide desktop instrument; it scrolls on small screens.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
