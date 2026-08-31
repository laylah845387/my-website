import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className = "" }: PageContainerProps) {
  return (
    <div className={`max-w-[1400px] mx-auto px-6 py-10 ${className}`}>
      {children}
    </div>
  );
}
