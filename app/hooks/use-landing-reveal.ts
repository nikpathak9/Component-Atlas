import { useEffect } from "react";

export function useLandingReveal(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(".landing-reveal"),
    );
    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [enabled]);
}
