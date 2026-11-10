import { lazy, Suspense, useEffect, useRef, useState } from "react";

const LandingProductPreview = lazy(() =>
  import("./landing-product-preview").then((module) => ({
    default: module.LandingProductPreview,
  })),
);

export function DeferredProductPreview({ theme }: { theme: "light" | "dark" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || shouldRender) return;
    if (!("IntersectionObserver" in window)) {
      const timeout = globalThis.setTimeout(() => setShouldRender(true), 0);
      return () => globalThis.clearTimeout(timeout);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldRender(true);
        observer.disconnect();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div
      className='landing-preview-slot landing-reveal'
      id='product'
      ref={containerRef}
    >
      {shouldRender ? (
        <Suspense fallback={<div className='landing-preview-placeholder' />}>
          <LandingProductPreview theme={theme} />
        </Suspense>
      ) : (
        <div className='landing-preview-placeholder' aria-hidden='true' />
      )}
    </div>
  );
}
