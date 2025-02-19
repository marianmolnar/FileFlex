import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/navbar";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "ConvertX - Free File Converter",
    description: "Convert your files easily with ConvertX",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <main className="min-h-screen px-4 pt-24 pb-4 md:px-8 lg:px-12 xl:px-16 2xl:px-24">
                        <Navbar />
                        {children}
                    </main>
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
