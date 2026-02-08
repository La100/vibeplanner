import { Github, Linkedin, Twitter } from "lucide-react";
import Link from "next/link";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Ritual library", href: "/rituals" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Guides", href: "/guides" },
      { label: "Case studies", href: "/stories" },
      { label: "Support", href: "/support" },
      { label: "Status", href: "/status" },
    ],
  },
];

const socials = [
  { label: "Twitter", href: "https://twitter.com", icon: Twitter },
  { label: "LinkedIn", href: "https://linkedin.com", icon: Linkedin },
  { label: "GitHub", href: "https://github.com", icon: Github },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#E7E2D9] bg-[#FAF7F2]">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16 sm:px-8 lg:flex-row lg:gap-20">
        <div className="flex-1 space-y-6">
          <Link href="/" className="flex items-center gap-3" aria-label="VibePlanner home">
            <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-[#C06A3D] text-lg font-semibold tracking-tight text-white">
              VP
            </span>
            <span className="text-2xl font-medium tracking-tight text-foreground font-[var(--font-display-serif)]">
              VibePlanner
            </span>
          </Link>
          <p className="max-w-sm text-sm leading-relaxed text-[#3C3A37]">
            VibePlanner helps ambitious teams maintain calm, consistent rituals. AI prepares the context, you focus on the decisions that move work forward.
          </p>
          <div className="flex items-center gap-4">
            {socials.map((social) => (
              <Link
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E7E2D9] text-[#3C3A37] transition-all duration-200 hover:-translate-y-0.5 hover:text-[#0E0E0E]"
              >
                <social.icon className="h-5 w-5" strokeWidth={1.8} />
              </Link>
            ))}
          </div>
        </div>

        <div className="grid flex-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title} className="space-y-4">
              <p className="text-xs uppercase tracking-[0.28em] text-[#8C8880]">
                {column.title}
              </p>
              <ul className="space-y-3 text-sm text-[#3C3A37]">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="transition-colors duration-200 hover:text-[#0E0E0E]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#E7E2D9]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 text-sm text-[#8C8880] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {currentYear} VibePlanner. Crafted for aligned, ambitious teams.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[#3C3A37]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#3C3A37]">
              Terms
            </Link>
            <Link href="/cookies" className="hover:text-[#3C3A37]">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
