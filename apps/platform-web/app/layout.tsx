import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { platformConfig } from "../instance.config";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: platformConfig.profile.brand.name,
    template: `%s · ${platformConfig.profile.brand.name}`,
  },
  description: platformConfig.profile.brand.shortDescription,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const { profile, theme } = platformConfig;
  const style = {
    "--accent": theme.accent,
    "--accent-strong": theme.accentStrong,
    "--canvas": theme.canvas,
    "--ink": theme.ink,
    "--muted": theme.muted,
    "--panel": theme.panel,
  } as CSSProperties;

  return (
    <html lang={profile.locales.default}>
      <body style={style}>{children}</body>
    </html>
  );
}
