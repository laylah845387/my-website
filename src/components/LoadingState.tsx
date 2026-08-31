import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 size={28} className="text-text-muted animate-spin" />
      <p className="text-[13px] font-medium tracking-[0.08em] text-text-secondary uppercase">
        {message}
      </p>
    </div>
  );
}
