"use client";

import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

const IMG_BASE =
  "https://pub-8abee449136941f5b0a1cd2c014534e9.r2.dev/vault-listing-images/assets-images/stack-spread";

const IMAGES = [
  { src: `${IMG_BASE}/img8.png`, alt: "Plane" },
  { src: `${IMG_BASE}/img2.png`, alt: "Painting" },
  { src: `${IMG_BASE}/img7.png`, alt: "Breaker" },
  { src: `${IMG_BASE}/img3.png`, alt: "Dog" },
  { src: `${IMG_BASE}/img5.png`, alt: "Footballer" },
  { src: `${IMG_BASE}/img6.png`, alt: "Jacket" },
  { src: `${IMG_BASE}/img1.png`, alt: "Meadow" },
  { src: `${IMG_BASE}/img4.png`, alt: "Stripes" },
];

// Generate a 3D volumetric spread using Z-axis depth
const generateSpatialCards = () => {
  // Pre-calculated coordinates to ensure an aesthetic, balanced scatter in 3D space
  const spatialCoordinates = [
    { x: -28, y: -18, z: 250 }, // Front Left
    { x: 30, y: -22, z: 150 },  // Front Right High
    { x: -32, y: 20, z: 80 },   // Mid Left Low
    { x: 28, y: 18, z: -50 },   // Mid Right Low
    { x: -16, y: 28, z: -150 }, // Back Left Bottom
    { x: 18, y: -32, z: -250 }, // Back Right Top
    { x: -12, y: -30, z: -350 },// Deep Left Top
    { x: 12, y: 32, z: -450 },  // Deep Right Bottom
  ];

  return IMAGES.map((item, i) => {
    const coords = spatialCoordinates[i];
    // Cards slightly angle inward to face the user center
    const rotateY = coords.x * -0.5;
    const rotateX = coords.y * 0.5;

    return {
      item,
      // Stacked tightly in the center with slight messy rotation
      stacked: { x: 0, y: 0, z: i * 2, rotateZ: (i - 3.5) * 4, rotateY: 0, rotateX: 0 },
      // Exploded into spatial coordinates
      spatial: {
        x: coords.x,
        y: coords.y,
        z: coords.z,
        rotateZ: (i - 3.5) * 1.5,
        rotateY,
        rotateX,
      },
    };
  });
};

const CARDS = generateSpatialCards();

// Fluid physics for the 3D scene tilt and scroll smoothing
const SCENE_SPRING = { stiffness: 40, damping: 30, mass: 1 };
const SCROLL_SPRING = { stiffness: 80, damping: 25, restDelta: 0.001 };

function useSceneParallax(active: boolean, enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const tiltX = useSpring(rawX, SCENE_SPRING);
  const tiltY = useSpring(rawY, SCENE_SPRING);

  useEffect(() => {
    if (!enabled || !active) {
      rawX.set(0);
      rawY.set(0);
      return;
    }
    const onMove = (e: PointerEvent) => {
      // Moves the entire perspective camera based on mouse position
      rawX.set((e.clientY / window.innerHeight - 0.5) * -15);
      rawY.set((e.clientX / window.innerWidth - 0.5) * 15);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [active, enabled, rawX, rawY]);

  return { tiltX, tiltY };
}

function SpatialCard({
  card,
  index,
  progress,
  isSpreadActive,
  hoveredIndex,
  setHoveredIndex,
}: any) {
  const { item, stacked, spatial } = card;

  // Transform coordinates based on the scroll progress
  const xRaw = useTransform(progress, [0, 1], [stacked.x, spatial.x]);
  const yRaw = useTransform(progress, [0, 1], [stacked.y, spatial.y]);
  const z = useTransform(progress, [0, 1], [stacked.z, spatial.z]);
  
  // Natively convert to string to prevent layout recalculation jitter
  const x = useTransform(xRaw, (v) => `${v}vw`);
  const y = useTransform(yRaw, (v) => `${v}vh`);

  const rotateZ = useTransform(progress, [0, 1], [stacked.rotateZ, spatial.rotateZ]);
  const rotateY = useTransform(progress, [0, 1], [stacked.rotateY, spatial.rotateY]);
  const rotateX = useTransform(progress, [0, 1], [stacked.rotateX, spatial.rotateX]);

  // Hide images entirely at progress 0, scale up slightly as they move out
  const scale = useTransform(progress, [0, 0.1, 1], [0, 0.65, 0.8]);
  const baseOpacity = useTransform(progress, [0, 0.1, 1], [0, 1, 1]);

  // Determine global focus states (dims other cards when one is hovered)
  const isDimmed = hoveredIndex !== null && hoveredIndex !== index;

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 pointer-events-none"
      style={{
        zIndex: stacked.z, // Z-index maps natively into the 3D space
        opacity: baseOpacity,
        width: "14vw",
        height: "20vh",
        // Note: Using translate3d triggers hardware acceleration natively.
        transform: useTransform(
          [x, y, z, rotateX, rotateY, rotateZ, scale],
          ([tx, ty, tz, rx, ry, rz, s]) =>
            `translate3d(calc(-50% + ${tx}), calc(-50% + ${ty}), ${tz}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`
        ),
      }}
    >
      <motion.div
        className="will-change-transform cursor-pointer pointer-events-auto h-full w-full rounded-[1.5vw] shadow-2xl shadow-black/40 ring-1 ring-white/20 transition-all duration-500 hover:shadow-cyan-500/20 hover:ring-white/40"
        onMouseEnter={() => isSpreadActive && setHoveredIndex(index)}
        onMouseLeave={() => isSpreadActive && setHoveredIndex(null)}
        animate={{
          opacity: isDimmed ? 0.3 : 1,
          filter: isDimmed ? "blur(6px) brightness(0.5)" : "blur(0px) brightness(1)",
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        whileHover={
          isSpreadActive
            ? {
                scale: 1.1,
                rotateX: 0, // Flatten out to face the camera directly on hover
                rotateY: 0,
                transition: { type: "spring", stiffness: 400, damping: 25 },
              }
            : undefined
        }
      >
        <div className="relative h-full w-full overflow-hidden rounded-[1.5vw]">
          <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/10 z-10 pointer-events-none" />
          <img
            src={item.src}
            alt={item.alt}
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 hover:scale-110"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function SpatialDepthHero() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  
  // Track which item is currently being hovered
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [spread, setSpread] = useState(false);

  // Re-implemented Scroll Logic
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, SCROLL_SPRING);
  // Maps the scroll progress so the animation completes between 10% and 80% of the section
  const progress = useTransform(smoothProgress, [0.1, 0.8], [0, 1]);

  // Activate hover states only when the cards are mostly spread out
  useMotionValueEvent(progress, "change", (p) => setSpread(p > 0.8));

  const { tiltX, tiltY } = useSceneParallax(spread, !reduce);

  // Text dynamically reacts to the cards exploding outward based on scroll
  const textBlur = useTransform(progress, [0, 0.2, 1], ["blur(0px)", "blur(0px)", "blur(12px)"]);
  const textOpacity = useTransform(progress, [0, 0.2, 1], [1, 1, 0.2]);
  const textScale = useTransform(progress, [0, 1], [1, 0.8]);

  return (
    // Reverted back to h-[400vh] to allow for a rich, long scrolling experience
    <section ref={wrapRef} className="relative w-full h-[400vh] bg-neutral-950">
      
      {/* Deep Space Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800/30 via-neutral-950 to-neutral-950" />

      {/* Perspective Wrapper - Sticky to keep it in view while scrolling the 400vh height */}
      <div
        className="sticky top-0 h-[100svh] w-full overflow-hidden flex items-center justify-center"
        style={{ perspective: "1000px" }}
      >
        {/* 3D Scene Container - Tilts the entire environment */}
        <motion.div
          className="absolute inset-0 z-10"
          style={{
            rotateX: tiltX,
            rotateY: tiltY,
            transformStyle: "preserve-3d", // Allows children to share the 3D space
          }}
        >
          {CARDS.map((card, i) => (
            <SpatialCard
              key={i}
              index={i}
              card={card}
              progress={progress}
              isSpreadActive={spread}
              hoveredIndex={hoveredIndex}
              setHoveredIndex={setHoveredIndex}
            />
          ))}
        </motion.div>

        {/* Central Spatial Typography */}
        <motion.div
          className="pointer-events-none absolute z-[5] flex flex-col items-center text-center px-6"
          style={{
            opacity: textOpacity,
            scale: textScale,
            filter: textBlur,
            // Sits at Z:0, meaning some cards will fly IN FRONT of it, and some BEHIND it.
            transform: "translateZ(0px)",
          }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md">
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-medium uppercase tracking-widest text-neutral-300">
              Volumetric Depth
            </span>
          </div>
          <h2 className="text-[5vw] font-medium tracking-tight text-white max-md:text-[10vw]">
            Break the 2D Plane.
          </h2>
          <p className="mt-4 max-w-[40ch] text-[1.1vw] font-light leading-relaxed text-neutral-400 max-md:text-[3.5vw]">
            Experience spatial layout scaling. Notice how assets physically drift
            through the digital space, bringing life to the interface.
          </p>
        </motion.div>
      </div>
    </section>
  );
}