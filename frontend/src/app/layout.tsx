import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Compass } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CAP Compass | AI-Powered Admission Predictor",
  description: "Explore engineering colleges, understand historical cutoffs, and make informed CAP counselling decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-soft-bg text-foreground min-h-screen antialiased selection:bg-electric-blue/20`}>
        <div className="flex flex-col min-h-screen">
          <header className="fixed w-full bg-white/80 backdrop-blur-md border-b border-border z-50">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
              
              {/* Left: Logo */}
              <div className="flex items-center gap-2 group cursor-pointer">
                <div className="text-electric-blue transition-transform group-hover:rotate-45 duration-500">
                  <Compass size={28} strokeWidth={2.5} />
                </div>
                <span className="font-bold tracking-tight text-lg text-primary">CAP COMPASS</span>
              </div>
              
              {/* Center: Navigation */}
              <nav className="hidden md:flex items-center gap-8 font-medium text-sm text-text-secondary">
                <a href="/explorer" className="hover:text-primary transition-colors">Explore Colleges</a>
                <a href="/" className="hover:text-primary transition-colors text-primary font-semibold">College Predictor</a>
                <a href="/compare" className="hover:text-primary transition-colors">Compare</a>
                <a href="/analytics" className="hover:text-primary transition-colors">Cutoff Analytics</a>
                <a href="#" className="hover:text-primary transition-colors">How It Works</a>
              </nav>
              
              {/* Right: Actions */}
              <div className="hidden md:flex items-center gap-4 text-sm font-medium">
                <button className="text-text-secondary hover:text-primary transition-colors">Sign In</button>
                <button className="bg-primary hover:bg-navy-800 text-white px-4 py-2 rounded-lg transition-all shadow-sm">
                  Get Started
                </button>
              </div>

            </div>
          </header>
          
          <main className="flex-1 flex flex-col pt-16">
            {children}
          </main>
          
          <footer className="bg-white border-t border-border py-12 text-sm text-text-secondary">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <Compass size={24} className="text-electric-blue" />
                  <span className="font-bold tracking-tight text-lg text-primary">CAP COMPASS</span>
                </div>
                <p className="max-w-xs leading-relaxed">
                  Navigate Maharashtra engineering admissions with data-driven college discovery and historical cutoff insights.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-4">Platform</h4>
                <ul className="space-y-2">
                  <li><a href="/" className="hover:text-electric-blue transition-colors">Predictor</a></li>
                  <li><a href="/explorer" className="hover:text-electric-blue transition-colors">Explorer</a></li>
                  <li><a href="/compare" className="hover:text-electric-blue transition-colors">Compare</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="hover:text-electric-blue transition-colors">Terms of Service</a></li>
                  <li><a href="#" className="hover:text-electric-blue transition-colors">Privacy Policy</a></li>
                  <li><a href="#" className="hover:text-electric-blue transition-colors">Disclaimer</a></li>
                </ul>
              </div>
            </div>
            <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
              <p>&copy; {new Date().getFullYear()} CAP Compass. All rights reserved.</p>
              <p className="text-xs text-text-secondary/70">Not an official counselling portal.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
