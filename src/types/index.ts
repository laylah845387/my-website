export type User = {
  id: string;
  discordId?: string;
  username?: string;
  points: number;
  createdAt: string;
};

export type Reward = {
  id: string;
  name: string;
  description: string;
  category: string;
  stock: number | "UNLIMITED";
  points: number;
  image: string;
};

export type Offer = {
  id: string;
  type: string;
  duration: string;
  points: number;
  rating: number;
  title?: string;
  description?: string;
  provider?: string;
  url?: string;
};

export type Order = {
  id: string;
  rewardId: string;
  rewardName: string;
  rewardImage: string;
  points: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  delivered: boolean;
  discordId?: string;
  createdAt: string;
};

export type UserProgress = {
  userId: string;
  completedOffers: string[];
  totalPointsEarned: number;
};

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
};
