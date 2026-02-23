"use client";

import { useState, useEffect } from "react";

const LEAF_PATHS = [
  "M12 1C13.5 5 17 7.5 17 12C17 16.5 13.5 20.5 12 23C10.5 20.5 7 16.5 7 12C7 7.5 10.5 5 12 1Z",
  "M10 2C12.5 4.5 16 6 16 11C16 16 12.5 20 10 22C7.5 20 4 16 4 11C4 6 7.5 4.5 10 2Z",
  "M11 1.5C13 4 15.5 6 15.5 10.5C15.5 15 13 19 11 21.5C9 19 6.5 15 6.5 10.5C6.5 6 9 4 11 1.5Z",
];

const LEAF_CONFIGS = [
  { left: 2, delay: 0, duration: 25, size: 12, path: 0, colorIdx: 0 },
  { left: 8, delay: 12, duration: 23, size: 11, path: 1, colorIdx: 1 },
  { left: 15, delay: 8, duration: 22, size: 14, path: 1, colorIdx: 1 },
  { left: 22, delay: 5, duration: 26, size: 10, path: 2, colorIdx: 2 },
  { left: 25, delay: 3, duration: 28, size: 11, path: 2, colorIdx: 2 },
  { left: 32, delay: 19, duration: 24, size: 13, path: 0, colorIdx: 0 },
  { left: 38, delay: 15, duration: 24, size: 15, path: 0, colorIdx: 0 },
  { left: 44, delay: 2, duration: 27, size: 12, path: 1, colorIdx: 1 },
  { left: 48, delay: 6, duration: 26, size: 13, path: 1, colorIdx: 1 },
  { left: 54, delay: 16, duration: 22, size: 14, path: 2, colorIdx: 2 },
  { left: 58, delay: 11, duration: 23, size: 14, path: 2, colorIdx: 2 },
  { left: 64, delay: 7, duration: 25, size: 11, path: 0, colorIdx: 0 },
  { left: 68, delay: 4, duration: 27, size: 12, path: 0, colorIdx: 0 },
  { left: 74, delay: 20, duration: 21, size: 15, path: 1, colorIdx: 1 },
  { left: 78, delay: 18, duration: 25, size: 16, path: 1, colorIdx: 1 },
  { left: 82, delay: 1, duration: 28, size: 10, path: 2, colorIdx: 2 },
  { left: 88, delay: 9, duration: 21, size: 13, path: 2, colorIdx: 2 },
  { left: 92, delay: 14, duration: 26, size: 12, path: 0, colorIdx: 0 },
  { left: 95, delay: 14, duration: 29, size: 11, path: 0, colorIdx: 0 },
  { left: 98, delay: 22, duration: 24, size: 14, path: 1, colorIdx: 1 },
];

export function SakuraLeaves() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {LEAF_CONFIGS.map((leaf, i) => (
        <svg
          key={`leaf-${i}-${leaf.left}`}
          className="sakura-leaf absolute"
          style={{
            left: `${leaf.left}%`,
            width: leaf.size,
            height: leaf.size,
            opacity: 0,
            animation: `sakura-fall-${(i % 3) + 1} ${leaf.duration}s linear infinite`,
            animationDelay: `${leaf.delay}s`,
          }}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d={LEAF_PATHS[leaf.path]}
            fill={`var(--leaf-color-${leaf.colorIdx})`}
          />
        </svg>
      ))}
    </div>
  );
}
