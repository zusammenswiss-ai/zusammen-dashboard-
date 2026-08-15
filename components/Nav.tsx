"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Calculator,
  Sprout,
  FolderOpen,
  Lightbulb,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/suppliers", label: "Suppliers", icon: Users },
  { href: "/tasks", label: "Tasks", icon: KanbanSquare },
  { href: "/finance", label: "Finance", icon: Calculator },
  { href: "/marketing", label: "Marketing", icon: Sprout },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/future-plans", label: "Future Plans", icon: Lightbulb },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-forest px-4 py-3 lg:hidden">
        <Brand />
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
          className="rounded-md p-2 text-ivory hover:bg-forest-light"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        className={`${
          open ? "block" : "hidden"
        } w-full shrink-0 bg-forest lg:block lg:w-64`}
      >
        <div className="hidden px-6 py-7 lg:block">
          <Brand />
        </div>
        <nav className="flex flex-col gap-1 px-3 pb-6 lg:px-4">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-bronze text-white"
                    : "text-ivory/80 hover:bg-forest-light hover:text-ivory"
                }`}
              >
                <Icon size={17} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden px-6 pb-6 text-xs leading-relaxed text-ivory/40 lg:block">
          Zusammen — premium Swiss conversation cards. Founder dashboard, v1.
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bronze font-serif text-sm font-semibold text-white">
        Z
      </span>
      <span className="font-serif text-lg font-medium tracking-wide text-ivory">
        Zusammen
      </span>
    </Link>
  );
}
