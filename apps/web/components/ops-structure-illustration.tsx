import { cn } from "@autocashback/ui";

export function OpsStructureIllustration(props: {
  className?: string;
  compact?: boolean;
}) {
  const width = props.compact ? 520 : 720;
  const height = props.compact ? 360 : 500;

  return (
    <svg
      aria-hidden="true"
      className={cn("h-auto w-full", props.className)}
      fill="none"
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        fill="#FCFBF8"
        height={height - 24}
        rx={26}
        stroke="#D8D1C1"
        strokeWidth="1.5"
        width={width - 24}
        x="12"
        y="12"
      />
      <rect fill="#F3EFE6" height={height - 56} rx="18" width={width * 0.22} x="28" y="28" />
      <rect fill="#FFFFFF" height={height - 56} rx="18" width={width * 0.65} x={width * 0.29} y="28" />

      <rect fill="#E8E1D2" height="16" rx="8" width={width * 0.12} x="44" y="52" />
      <rect fill="#D3CAB7" height="24" rx="12" width={width * 0.14} x="44" y="92" />
      <rect fill="#E8E1D2" height="24" rx="12" width={width * 0.14} x="44" y="132" />
      <rect fill="#E8E1D2" height="24" rx="12" width={width * 0.14} x="44" y="172" />

      <rect fill="#F6F2E9" height="72" rx="18" stroke="#D8D1C1" width={width * 0.57} x={width * 0.33} y="52" />
      <rect fill="#4C705F" height="10" rx="5" width={width * 0.11} x={width * 0.36} y="76" />
      <rect fill="#B6C3BA" height="10" rx="5" width={width * 0.22} x={width * 0.36} y="96" />
      <rect fill="#E8E1D2" height="24" rx="12" width={width * 0.1} x={width * 0.74} y="74" />

      <rect fill="#F6F2E9" height="102" rx="18" stroke="#D8D1C1" width={width * 0.26} x={width * 0.33} y="148" />
      <rect fill="#F6F2E9" height="102" rx="18" stroke="#D8D1C1" width={width * 0.26} x={width * 0.63} y="148" />
      <rect fill="#4C705F" height="12" rx="6" width={width * 0.1} x={width * 0.36} y="172" />
      <rect fill="#4C705F" height="12" rx="6" width={width * 0.1} x={width * 0.66} y="172" />
      <rect fill="#D2C8B5" height="10" rx="5" width={width * 0.16} x={width * 0.36} y="196" />
      <rect fill="#D2C8B5" height="10" rx="5" width={width * 0.16} x={width * 0.66} y="196" />
      <rect fill="#EDE6D9" height="16" rx="8" width={width * 0.18} x={width * 0.36} y="224" />
      <rect fill="#EDE6D9" height="16" rx="8" width={width * 0.18} x={width * 0.66} y="224" />

      <path d={`M${width * 0.46} ${height * 0.57} L${width * 0.46} ${height * 0.69} L${width * 0.76} ${height * 0.69}`} stroke="#4C705F" strokeLinecap="round" strokeWidth="3" />
      <path d={`M${width * 0.76} ${height * 0.57} L${width * 0.76} ${height * 0.69}`} stroke="#4C705F" strokeLinecap="round" strokeWidth="3" />

      <rect fill="#FFFDF8" height="86" rx="18" stroke="#D8D1C1" width={width * 0.18} x={width * 0.33} y={height * 0.72} />
      <rect fill="#FFFDF8" height="86" rx="18" stroke="#D8D1C1" width={width * 0.18} x={width * 0.54} y={height * 0.72} />
      <rect fill="#FFFDF8" height="86" rx="18" stroke="#D8D1C1" width={width * 0.18} x={width * 0.75} y={height * 0.72} />

      <rect fill="#A48754" height="10" rx="5" width={width * 0.08} x={width * 0.36} y={height * 0.76} />
      <rect fill="#A48754" height="10" rx="5" width={width * 0.08} x={width * 0.57} y={height * 0.76} />
      <rect fill="#A48754" height="10" rx="5" width={width * 0.08} x={width * 0.78} y={height * 0.76} />
      <rect fill="#D2C8B5" height="10" rx="5" width={width * 0.11} x={width * 0.36} y={height * 0.8} />
      <rect fill="#D2C8B5" height="10" rx="5" width={width * 0.11} x={width * 0.57} y={height * 0.8} />
      <rect fill="#D2C8B5" height="10" rx="5" width={width * 0.11} x={width * 0.78} y={height * 0.8} />

      <circle cx={width * 0.305} cy={height * 0.29} fill="#4C705F" r="7" />
      <circle cx={width * 0.305} cy={height * 0.44} fill="#A48754" r="7" />
      <circle cx={width * 0.305} cy={height * 0.77} fill="#4C705F" r="7" />
    </svg>
  );
}
