import { Package } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title = "Nothing here yet",
  message = "Check back later.",
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      {icon || <Package size={40} className="text-text-muted" />}
      <h3 className="text-[15px] font-bold tracking-[0.06em] text-text-secondary uppercase">
        {title}
      </h3>
      <p className="text-[13px] text-text-muted text-center max-w-[300px]">
        {message}
      </p>
    </div>
  );
}
