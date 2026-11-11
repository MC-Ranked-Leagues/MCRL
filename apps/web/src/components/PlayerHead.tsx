import { useEffect, useEffectEvent, useRef, useState } from "react";
import { headUrl, STEVE_HEAD } from "@/lib/playerHead";
import { cn } from "@/lib/utils";

export function PlayerHead({
  player,
  className,
}: {
  player: string;
  className?: string;
}) {
  const url = headUrl(player);
  // A face that fails to load shows Steve instead of an empty square.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = failedUrl === url ? STEVE_HEAD : url;
  const imageRef = useRef<HTMLImageElement>(null);
  // Tracks the source, so a reused element pulses again for a new player.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  function handleError() {
    if (src === STEVE_HEAD) setLoadedSrc(src);
    else setFailedUrl(url);
  }

  // Images from the page's HTML can finish, or fail, before React attaches
  // its handlers.
  const checkFinished = useEffectEvent(() => {
    const image = imageRef.current;
    if (!image?.complete) return;
    if (image.naturalWidth === 0) handleError();
    else setLoadedSrc(src);
  });
  useEffect(() => checkFinished(), [src]);

  return (
    <img
      ref={imageRef}
      src={src}
      alt=""
      width={64}
      height={64}
      loading="lazy"
      onLoad={() => setLoadedSrc(src)}
      onError={handleError}
      className={cn(
        "size-8 shrink-0 [image-rendering:pixelated]",
        loadedSrc !== src && "animate-pulse bg-background-raised",
        className
      )}
    />
  );
}
