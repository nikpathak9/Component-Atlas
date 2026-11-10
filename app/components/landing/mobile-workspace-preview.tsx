import { memo } from "react";

const transparentPixel =
  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

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
      <source
        media='(max-width: 760px)'
        srcSet={`/previews/workspace-${theme}.jpg`}
      />
      <img
        src={transparentPixel}
        width='1200'
        height='820'
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding={eager ? "sync" : "async"}
        fetchPriority={eager ? "high" : "auto"}
      />
    </picture>
  );
});
