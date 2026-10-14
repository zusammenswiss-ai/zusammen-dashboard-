"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Heart, Coffee, Mountain, Waves, type LucideIcon } from "lucide-react";

const PALETTE = {
  forest: "#233328",
  pine: "#314537",
  walnut: "#7a5a3b",
  bronze: "#b08a52",
  gold: "#c8a96b",
  ivory: "#f3efe7",
};

type FanCardSpec = {
  icon: LucideIcon;
  question: string;
  fill: string;
  rotate: number;
  x: number;
  y: number;
};

/**
 * A no-photography-needed hero visual: three card faces fanned out,
 * drawn purely in CSS (brand palette + a suit icon + a sample
 * question), not real product photography — there isn't any yet (see
 * app/first20/page.tsx). Swap this out for real card photos later by
 * replacing the `cards` array below with <Image> elements once
 * photography exists; the layout/animation stays the same either way.
 */
export default function HeroCards({ cards }: { cards: { icon: LucideIcon; question: string }[] }) {
  const prefersReducedMotion = useReducedMotion();

  const specs: FanCardSpec[] = cards.slice(0, 3).map((c, i) => {
    const fills = [PALETTE.pine, PALETTE.walnut, PALETTE.bronze];
    const rotations = [-12, 0, 12];
    const xs = [-56, 0, 56];
    const ys = [10, -14, 10];
    return { ...c, fill: fills[i], rotate: rotations[i], x: xs[i], y: ys[i] };
  });

  return (
    <div className="relative mx-auto flex h-[340px] w-full max-w-sm items-center justify-center sm:h-[400px]">
      {specs.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={i}
            className="absolute flex h-[260px] w-[170px] flex-col items-center justify-between rounded-2xl border p-5 text-center shadow-xl sm:h-[300px] sm:w-[200px]"
            style={{
              backgroundColor: card.fill,
              borderColor: PALETTE.gold,
              color: PALETTE.ivory,
              zIndex: i === 1 ? 2 : 1,
            }}
            initial={{
              opacity: 0,
              rotate: card.rotate,
              x: card.x,
              y: prefersReducedMotion ? card.y : card.y + 24,
            }}
            whileInView={{ opacity: 1, rotate: card.rotate, x: card.x, y: card.y }}
            whileHover={prefersReducedMotion ? undefined : { y: card.y - 16, rotate: card.rotate * 0.4, zIndex: 3 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: "easeOut", delay: i * 0.08 }}
          >
            <Icon size={28} strokeWidth={1.5} color={PALETTE.gold} />
            <p className="font-serif text-[15px] leading-snug" style={{ color: PALETTE.ivory }}>
              {card.question}
            </p>
            <span
              className="text-[9px] font-medium uppercase tracking-[0.2em]"
              style={{ color: PALETTE.gold, opacity: 0.8 }}
            >
              Zusammen
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

export const FIRST20_SUIT_ICONS = { heart: Heart, cup: Coffee, mountain: Mountain, lake: Waves } as const;
