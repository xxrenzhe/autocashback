export function BrandMark(props: { compact?: boolean }) {
  const sizeClasses = props.compact ? "h-10 w-10 rounded-lg text-sm" : "h-12 w-12 rounded-[20px] text-base";

  return (
    <div
      className={`flex items-center justify-center bg-primary font-semibold tracking-[0.2em] text-white shadow-md shadow-emerald-700/15 ${sizeClasses}`}
    >
      AC
    </div>
  );
}
