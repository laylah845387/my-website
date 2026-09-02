import { Offer, UserProgress } from "@/types";

export interface OfferwallProvider {
  getOffers(userId: string, userIp?: string): Promise<Offer[]>;
  getUserProgress(userId: string): Promise<UserProgress>;
  startOffer(userId: string, offerId: string, userIp?: string): Promise<{ redirectUrl?: string }>;
  onOfferCompleted?(userId: string, offerId: string, points: number): Promise<void>;
}
