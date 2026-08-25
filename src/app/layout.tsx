import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#08090d",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Avneesh Kumar | Data Analyst & Analytics Engineer",
  description:
    "Data Analyst with hands-on experience in SQL, Python, Power BI, data pipelines, machine learning, Neo4j graph analytics, and real-time analytics dashboards.",
  keywords: [
    "Avneesh Kumar",
    "Data Analyst",
    "Analytics Engineer",
    "SQL",
    "Python",
    "Power BI",
    "Neo4j",
    "Graph Analytics",
    "ETL Pipelines",
    "Anomaly Detection",
    "Machine Learning",
    "Portfolio",
  ],
  authors: [{ name: "Avneesh Kumar", url: "https://dev.avneeshkumar@gmail.com" }],
  creator: "Avneesh Kumar",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://wavio.codes",
    title: "Avneesh Kumar | Data Analyst & Analytics Engineer",
    description:
      "Transforming complex data into real-time intelligence, predictive systems, and automated graph/anomaly detection platforms.",
    siteName: "Avneesh Kumar Portfolio",
  },
  twitter: {
    card: "summary_large_image",
    title: "Avneesh Kumar | Data Analyst & Analytics Engineer",
    description:
      "Specializing in SQL, Python, Power BI, real-time data pipelines, and graph analytics.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} scroll-smooth dark`}>
      <body className="font-sans bg-bg text-slate-100 antialiased selection:bg-accent-cyan/20 selection:text-accent-cyan">
        {children}
      </body>
    </html>
  );
}
