import { Offer, UserProgress } from "@/types";
import { offers as mockOffers } from "@/data/offers";
import { OfferwallProvider } from "./types";

/**
 * BitcotasksProvider
 *
 * Placeholder implementation of the OfferwallProvider interface.
 * Currently returns mock data for development and demo purposes.
 *
 * TODO: Connect to official Bitcotasks API / SDK once credentials
 * and API specification are supplied.
 *
 * Integration points:
 * - Replace getOffers() with actual Bitcotasks API call
 * - Replace getUserProgress() with actual progress tracking
 * - Implement startOffer() to redirect to Bitcotasks offer flow
 * - Implement onOfferCompleted() webhook handler for completion callbacks
 */
export class BitcotasksProvider implements OfferwallProvider {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.BITCOTASKS_API_URL || "";
    this.apiKey = process.env.BITCOTASKS_API_KEY || "";
  }

  async getOffers(_userId: string): Promise<Offer[]> {
    // TODO: Connect to official Bitcotasks API
    // const response = await fetch(`${this.apiUrl}/offers?userId=${userId}`, {
    //   headers: { Authorization: `Bearer ${this.apiKey}` },
    // });
    // return response.json();

    return mockOffers;
  }

  async getUserProgress(_userId: string): Promise<UserProgress> {
    // TODO: Connect to official Bitcotasks API
    // const response = await fetch(`${this.apiUrl}/progress?userId=${userId}`, {
    //   headers: { Authorization: `Bearer ${this.apiKey}` },
    // });
    // return response.json();

    return {
      userId: _userId,
      completedOffers: [],
      totalPointsEarned: 0,
    };
  }

  async startOffer(
    _userId: string,
    _offerId: string
  ): Promise<{ redirectUrl?: string }> {
    // TODO: Connect to official Bitcotasks offer start endpoint
    // This should return the URL where the user completes the task
    return { redirectUrl: undefined };
  }

  async onOfferCompleted(
    _userId: string,
    _offerId: string,
    _points: number
  ): Promise<void> {
    // TODO: Handle Bitcotasks completion webhook/callback
    // Verify completion with Bitcotasks API
    // Award points to user
  }
}
