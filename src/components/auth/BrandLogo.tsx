import { Building2 } from 'lucide-react';

interface BrandLogoProps {
  inverted?: boolean;
}

export function BrandLogo({ inverted = false }: BrandLogoProps) {
  return (
    <div className="inline-flex items-center gap-3" aria-label="ARBORIS">
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border shadow-soft ${
        inverted
          ? 'border-white/25 bg-white/15 text-white backdrop-blur-md'
          : 'border-wood-100 bg-wood-500 text-white'
      }`}>
        <Building2 className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className={`block font-serif text-xl font-semibold tracking-[0.08em] ${
          inverted ? 'text-white' : 'text-charcoal-900'
        }`}>
          ARBORIS
        </span>
        <span className={`block text-[10px] font-semibold uppercase tracking-[0.24em] ${
          inverted ? 'text-white/60' : 'text-charcoal-400'
        }`}>
          Cổng người thuê
        </span>
      </span>
    </div>
  );
}
