"use client";

import { useRef, useState } from "react";
import { Smile, Hand, Heart, Coffee, Zap } from "lucide-react";
import { useDismiss } from "./ui";
import { cn } from "@/lib/utils";

// Curated set — keeps the bundle small (no emoji library dependency)
const CATEGORIES = [
  {
    id: "smileys",
    label: "Smileys",
    icon: Smile,
    emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😜 🤪 😎 🤓 🥳 😏 😌 😴 🤔 🫡 🤗 😮 😲 😢 😭 😤 😡 🥺 😱 🙄 😬 🤯 🥶".split(" "),
  },
  {
    id: "gestures",
    label: "Gestures",
    icon: Hand,
    emojis: "👍 👎 👏 🙌 🙏 🤝 👌 ✌️ 🤞 🤟 🤘 👋 🤙 💪 ☝️ 👆 👇 👉 👈 ✋ 🫶 🫰 ✍️ 🙋 🤷 🤦".split(" "),
  },
  {
    id: "hearts",
    label: "Hearts",
    icon: Heart,
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝 ✨ ⭐ 🌟 💫 🔥".split(" "),
  },
  {
    id: "food",
    label: "Food & drink",
    icon: Coffee,
    emojis: "☕ 🍵 🍕 🍔 🍟 🌮 🍣 🍜 🍩 🍪 🎂 🍫 🍿 🍎 🍓 🥑 🍺 🍷 🥂 🍹".split(" "),
  },
  {
    id: "objects",
    label: "Activity & objects",
    icon: Zap,
    emojis: "🎉 🎊 🎁 🏆 ⚽ 🏀 🎮 🎧 🎵 📷 💻 📱 💡 🚀 ✈️ 🌍 🌈 ☀️ 🌙 ⚡ ✅ ❌ ⚠️ 💯 👀".split(" "),
  },
];

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

export function EmojiPicker({ onPick, onClose, className }: EmojiPickerProps) {
  const [active, setActive] = useState(CATEGORIES[0].id);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);

  const category = CATEGORIES.find((c) => c.id === active) ?? CATEGORIES[0];

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Emoji picker"
      className={cn(
        "w-[19.5rem] max-w-[calc(100vw-2rem)] animate-pop-in overflow-hidden rounded-2xl border border-line bg-elevated shadow-pop",
        className
      )}
    >
      <div className="flex border-b border-line px-1.5 pt-1.5" role="tablist">
        {CATEGORIES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={id === active}
            aria-label={label}
            title={label}
            onClick={() => setActive(id)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-t-lg py-2 transition-colors",
              id === active
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-fg"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <p className="px-3 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {category.label}
      </p>
      <div className="grid h-44 grid-cols-8 content-start gap-0.5 overflow-y-auto p-2 scrollbar-thin">
        {category.emojis.map((e) => (
          <button
            key={e}
            onClick={() => onPick(e)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-subtle active:scale-95"
            aria-label={`Insert ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
