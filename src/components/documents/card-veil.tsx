/**
 * Voile progressif (flou + assombrissement) en bas de la carte, avec le titre.
 * Le flou est obtenu par plusieurs calques backdrop-filter d'intensité croissante,
 * chacun révélé par un masque en dégradé. Chaque calque porte data-zoom-fade pour
 * que la transition zoom puisse l'estomper individuellement.
 */
const BLUR_LAYERS = [
  { blur: 1, from: 0, to: 25 },
  { blur: 3, from: 20, to: 50 },
  { blur: 8, from: 45, to: 75 },
  { blur: 16, from: 70, to: 100 },
];

export function CardVeil({ title }: { title: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[50%]">
      {BLUR_LAYERS.map(({ blur, from, to }) => {
        const mask = `linear-gradient(to bottom, transparent ${from}%, #000 ${to}%)`;
        return (
          <div
            key={blur}
            data-zoom-fade
            className="absolute inset-0"
            style={{
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        );
      })}
      <div
        data-zoom-fade
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(10,10,10,0) 0%, rgba(10,10,10,0.35) 30%, rgba(10,10,10,0.72) 65%, rgba(10,10,10,0.88) 100%)",
        }}
      />
      <p
        data-zoom-fade
        className="absolute inset-x-0 bottom-0 line-clamp-2 px-3.5 pb-3.5 text-[15px] font-medium leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]"
      >
        {title}
      </p>
    </div>
  );
}
