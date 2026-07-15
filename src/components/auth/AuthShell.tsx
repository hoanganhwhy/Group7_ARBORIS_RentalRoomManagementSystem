import { useRef, type MouseEvent, type ReactNode } from 'react';
import apartmentImage from '../../assets/auth/apartment-login.png';
import { BrandLogo } from './BrandLogo';

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  const imageRef = useRef<HTMLImageElement>(null);

  const handlePointerMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;
    imageRef.current.style.transform = `scale(1.055) translate(${offsetX * 8}px, ${offsetY * 8}px)`;
  };

  const resetImage = () => {
    if (imageRef.current) imageRef.current.style.transform = 'scale(1.055) translate(0, 0)';
  };

  return (
    <main className="min-h-screen bg-cream-50 lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section
        className="relative hidden min-h-screen overflow-hidden lg:block"
        onMouseMove={handlePointerMove}
        onMouseLeave={resetImage}
        aria-label="Không gian căn hộ ARBORIS"
      >
        <img
          ref={imageRef}
          src={apartmentImage}
          alt="Căn hộ phong cách Scandinavian ấm áp"
          className="absolute inset-0 h-full w-full scale-[1.055] object-cover transition-transform duration-500 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/95 via-charcoal-900/35 to-charcoal-950/20" />
        <div className="absolute inset-0 bg-gradient-to-br from-wood-900/25 via-transparent to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-between p-10 xl:p-14">
          <BrandLogo inverted />
          <div className="max-w-xl pb-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.26em] text-cream-300">
              Một nơi ở · Một trải nghiệm
            </p>
            <h1 className="max-w-lg font-serif text-4xl font-semibold leading-[1.12] text-white xl:text-5xl">
              Cuộc sống thuê trọ nhẹ nhàng hơn mỗi ngày.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/70 xl:text-base">
              Theo dõi phòng ở, hóa đơn, hợp đồng và yêu cầu hỗ trợ trong một không gian riêng tư, rõ ràng và an toàn.
            </p>
            <div className="mt-8 flex items-center gap-3 text-xs font-medium text-white/60">
              <span className="h-px w-10 bg-white/35" />
              <span>Bảo mật tài khoản nhiều lớp</span>
            </div>
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-8 sm:px-8 lg:px-10 xl:px-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-wood-100/45 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-terra-100/40 blur-3xl" />
        <div className="relative w-full max-w-[480px]">
          <div className="mb-8 lg:hidden">
            <BrandLogo />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
