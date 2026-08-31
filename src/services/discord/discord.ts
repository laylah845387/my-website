/**
 * Discord Integration Service
 *
 * Placeholder for future Discord OAuth and user linking.
 *
 * TODO: Implement when Discord credentials are provided.
 *
 * Integration flow:
 * 1. User clicks "Login with Discord"
 * 2. Redirect to Discord OAuth2 authorization URL
 * 3. Handle callback with authorization code
 * 4. Exchange code for access token
 * 5. Fetch Discord user profile
 * 6. Link Discord account to CapeVerse user
 * 7. Persist association for future sessions
 */

export interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
  avatar?: string;
  email?: string;
}

export interface DiscordConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class DiscordService {
  private config: DiscordConfig;

  constructor() {
    this.config = {
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      redirectUri: process.env.DISCORD_REDIRECT_URI || "",
    };
  }

  /**
   * Generate the Discord OAuth2 authorization URL
   * TODO: Implement with actual Discord OAuth2 flow
   */
  getAuthorizationUrl(): string {
    // TODO: Construct proper Discord OAuth2 URL
    // return `https://discord.com/api/oauth2/authorize?client_id=${this.config.clientId}&redirect_uri=${encodeURIComponent(this.config.redirectUri)}&response_type=code&scope=identify+email`;
    return "#";
  }

  /**
   * Exchange authorization code for user data
   * TODO: Implement server-side token exchange
   */
  async authenticateUser(_code: string): Promise<DiscordUser | null> {
    // TODO: Exchange code for token, then fetch user
    return null;
  }

  /**
   * Link a Discord account to a CapeVerse user
   * TODO: Implement database association
   */
  async linkAccount(
    _capeVerseUserId: string,
    _discordUser: DiscordUser
  ): Promise<void> {
    // TODO: Save Discord <-> CapeVerse user association
  }

  /**
   * Get the linked Discord user for a CapeVerse user
   * TODO: Implement database lookup
   */
  async getLinkedAccount(
    _capeVerseUserId: string
  ): Promise<DiscordUser | null> {
    // TODO: Look up linked Discord account
    return null;
  }
}
