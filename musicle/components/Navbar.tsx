"use client";

import {
  Navbar as NavbarWrapper,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

const navItems = [
  { name: "Feed",       link: "/feed" },
  { name: "Sketchbook", link: "/sketchbook" },
  { name: "ML Engine",  link: "/ml" },
  { name: "Admin",      link: "/admin" },
  { name: "Pricing",    link: "/pricing" },
  { name: "Contact",    link: "/contact" },
];

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, loading, isAuthenticated, signOut } = useAuth();

  return (
    <nav className="relative z-50 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-6 mx-auto w-full">
      <NavbarWrapper className="rounded-full mx-auto">
        <NavBody>
          <NavbarLogo />
          <NavItems items={navItems} />

          <div className="flex items-center gap-3 flex-shrink-0 lg:pl-4 lg:border-l lg:border-white/10">
            {loading ? (
              <span className="text-xs text-white/40">Loading...</span>
            ) : isAuthenticated ? (
              <>
                <span className="hidden xl:block text-xs text-white/60 max-w-40 truncate">@{user?.userName}</span>
                <NavbarButton href="/dashboard" variant="secondary">
                  Dashboard
                </NavbarButton>
                <NavbarButton as="button" type="button" onClick={signOut} variant="primary">
                  Logout
                </NavbarButton>
              </>
            ) : (
              <>
                <NavbarButton href="/login" variant="primary">
                  Login
                </NavbarButton>
              </>
            )}
          </div>
        </NavBody>

        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <MobileNavToggle isOpen={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
          </MobileNavHeader>

          <MobileNavMenu isOpen={isMobileMenuOpen}>
            {navItems.map((item, idx) => (
              <a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className="relative text-neutral-600 dark:text-neutral-300"
              >
                <span className="block">{item.name}</span>
              </a>
            ))}

            <div className="flex w-full flex-col gap-4">
              {isAuthenticated ? (
                <>
                  <NavbarButton href="/dashboard" variant="primary" className="w-full" onClick={() => setIsMobileMenuOpen(false)}>
                    Dashboard
                  </NavbarButton>
                  <NavbarButton
                    as="button"
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      signOut();
                      setIsMobileMenuOpen(false);
                    }}
                  >
                    Logout
                  </NavbarButton>
                </>
              ) : (
                <>
                  <NavbarButton href="/login" variant="primary" className="w-full" onClick={() => setIsMobileMenuOpen(false)}>
                    Login
                  </NavbarButton>
                  <NavbarButton href="/call" variant="secondary" className="w-full" onClick={() => setIsMobileMenuOpen(false)}>
                    Book a call
                  </NavbarButton>
                </>
              )}
            </div>
          </MobileNavMenu>
        </MobileNav>
      </NavbarWrapper>
    </nav>
  );
}
