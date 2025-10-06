import type { SVGProps } from "react";

export function AhorroYaLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width="1em"
      height="1em"
      {...props}
    >
      <path fill="none" d="M0 0h256v256H0z" />
      <path
        fill="currentColor"
        d="M216 64h-31.54a48.06 48.06 0 0 0-88.92 0H40a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V80a16 16 0 0 0-16-16Zm-88-32a32 32 0 0 1 32 32h-64a32 32 0 0 1 32-32Zm88 160H40V80h56v16a8 8 0 0 0 8 8h64a8 8 0 0 0 8-8V80h56v144Z"
      />
      <circle fill="currentColor" cx="128" cy="140" r="12" />
    </svg>
  );
}
