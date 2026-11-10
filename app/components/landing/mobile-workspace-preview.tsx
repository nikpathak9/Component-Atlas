import { memo } from "react";

type Props = {
  theme: "light" | "dark";
  alt: string;
  eager?: boolean;
};

export const MobileWorkspacePreview = memo(function MobileWorkspacePreview({
  theme,
  alt,
  eager = false,
}: Props) {
  return (
    <picture className='mobile-workspace-preview'>
      <img
        src={`/previews/workspace-${theme}.png`}
        width={theme === "light" ? 2154 : 2147}
        height={theme === "light" ? 1353 : 1350}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding={eager ? "sync" : "async"}
        fetchPriority={eager ? "high" : "auto"}
      />
    </picture>
  );
});
