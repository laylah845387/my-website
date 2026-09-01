"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useApp } from "@/lib/store";
import DiscordIcon from "@/components/DiscordIcon";

const NAV_ITEMS = [
  { label: "HOME", href: "/" },
  { label: "EARN", href: "/earn" },
  { label: "REDEEM", href: "/redeem" },
  { label: "SUPPORT", href: "/support" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { session, sessionLoading, login, logout } = useApp();

  return (
    <header className="w-full border-b border-border bg-bg/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between h-[60px]">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <Image
            src="/logo.jpg"
            alt="GIVEAWAY HUB"
            width={36}
            height={36}
            className="rounded-md"
          />
          <span className="text-lg font-bold tracking-wider text-text-primary font-heading">
            GIVEAWAY HUB
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative text-[13px] font-semibold tracking-[0.12em] transition-colors duration-200 pb-1 ${
                  isActive
                    ? "text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-green shadow-[0_0_6px_rgba(74,222,128,0.5)] rounded-full" />
                )}
              </Link>
            );
          })}

          {/* Account area */}
          {sessionLoading ? (
            <div className="w-16 h-4 rounded bg-bg-card border border-border animate-pulse ml-2" />
          ) : session ? (
            <button
              onClick={logout}
              title={`Log out (${session.username})`}
              className="text-[13px] font-semibold tracking-[0.12em] text-accent-green hover:text-accent-green-dark transition-colors duration-200 cursor-pointer"
            >
              LOGOUT
            </button>
          ) : (
            <button
              onClick={login}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold tracking-[0.12em] text-accent-green hover:text-accent-green-dark transition-colors duration-200 cursor-pointer uppercase"
            >
              Login
            </button>
          )}

          {/* Discord community link */}
          <a
            href="#"
            className="text-text-primary hover:text-accent-green transition-colors"
            aria-label="Discord"
          >
            <DiscordIcon size={22} />
          </a>
        </nav>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-text-primary p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-bg">
          <nav className="flex flex-col px-6 py-4 gap-4">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`text-[13px] font-semibold tracking-[0.12em] transition-colors ${
                    isActive
                      ? "text-text-primary border-l-2 border-accent-green pl-3"
                      : "text-text-secondary hover:text-text-primary pl-3"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {!sessionLoading && session ? (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="text-[13px] font-semibold tracking-[0.12em] text-accent-green text-left pl-3 cursor-pointer"
              >
                LOGOUT
              </button>
            ) : !sessionLoading ? (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  login();
                }}
                className="text-[13px] font-semibold tracking-[0.12em] text-accent-green text-left pl-3 cursor-pointer"
              >
                Login
              </button>
            ) : null}
          </nav>
        </div>
      )}
    </header>
  );
}
