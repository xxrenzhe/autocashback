export function BrandMark(props: { compact?: boolean }) {
  const sizeClasses = props.compact ? "h-10 w-10 rounded-md text-sm" : "h-12 w-12 rounded-xl text-base";

  return (
    <div
      className={`flex items-center justify-center border border-primary/20 bg-primary/10 font-semibold tracking-[0.18em] text-primary shadow-[0_10px_24px_rgba(65,112,92,0.08)] ${sizeClasses}`}
    >
      AC
    </div>
  );
}
