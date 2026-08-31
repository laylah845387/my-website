"use client";

import Image from "next/image";
import { Order } from "@/types";
import { formatDate } from "@/lib/utils";

interface OrderCardProps {
  order: Order;
}

export default function OrderCard({ order }: OrderCardProps) {
  const statusStyles = {
    COMPLETED: "bg-accent-green/10 text-accent-green border-accent-green/20",
    PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    FAILED: "bg-accent-red/10 text-accent-red border-accent-red/20",
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-bg-card border border-border">
      {/* Reward image */}
      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-bg-elevated">
        <Image
          src={order.rewardImage}
          alt={order.rewardName}
          width={48}
          height={48}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Order info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-[14px] font-bold text-text-primary truncate">
          {order.rewardName}
        </h3>
        <p className="text-[11px] text-text-secondary mt-0.5">
          {formatDate(order.createdAt)}
        </p>
      </div>

      {/* Points */}
      <div className="text-right shrink-0">
        <div className="text-[14px] font-bold text-accent-green">
          {order.points}
        </div>
        <div className="text-[10px] font-semibold tracking-[0.1em] text-text-secondary uppercase">
          Points
        </div>
      </div>

      {/* Status badge */}
      <div
        className={`px-3 py-1 rounded-md border text-[10px] font-bold tracking-[0.1em] uppercase shrink-0 ${
          statusStyles[order.status]
        }`}
      >
        {order.status}
      </div>
    </div>
  );
}
