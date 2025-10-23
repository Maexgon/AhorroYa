import Image from "next/image";
import type { SVGProps } from "react";

export function AhorroYaLogo(props: Omit<SVGProps<SVGSVGElement>, "width" | "height">) {
  // Omit width and height from SVGProps to avoid conflict with Image component props
  const { className, ...rest } = props;
  return (
    <div className={className} style={{ position: 'relative' }}>
      <Image
        src="/img/logoAY.png"
        alt="Ahorro Ya Logo"
        fill
        sizes="160px" // Provide a reasonable size hint
        style={{ objectFit: 'contain' }}
        {...rest}
      />
    </div>
  );
}
