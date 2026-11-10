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
        src={`/previews/workspace-${theme}.jpg`}
        width='1800'
        height='1130'
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding={eager ? "sync" : "async"}
        fetchPriority={eager ? "high" : "auto"}
      />
    </picture>
  );
});
