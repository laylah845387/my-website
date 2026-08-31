import { Offer, UserProgress } from "@/types";

export interface OfferwallProvider {
  getOffers(userId: string): Promise<Offer[]>;
  getUserProgress(userId: string): Promise<UserProgress>;
  startOffer(userId: string, offerId: string): Promise<{ redirectUrl?: string }>;
  onOfferCompleted?(userId: string, offerId: string, points: number): Promise<void>;
}
