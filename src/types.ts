import type { messagingApi } from '@line/bot-sdk'

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * The LINE Messaging API client instance.
     * This client is used to send messages and interact with the LINE platform.
     */
    line: messagingApi.MessagingApiClient
  }

  interface FastifyRequest {
    /**
     * The raw body of the request.
     * This is populated when the `lineWebhook` config is set to `true`.
     * It contains the raw JSON payload sent by LINE.
     */
    rawBody?: string
  }

  interface FastifyContextConfig {
    /**
     * Whether to enable LINE webhook handling for this route.
     * If set to `true`, the plugin will automatically parse the raw body and verify the
     * signature of incoming requests.
     */
    lineWebhook?: boolean
  }
}

export interface FastifyLineOptions {
  /**
   * The channel secret of your LINE Messaging API channel.
   * This is used to verify the signature of incoming requests.
   */
  channelSecret: string
  /**
   * The channel access token of your LINE Messaging API channel.
   * This is used to send messages and interact with the LINE platform.
   */
  channelAccessToken: string
  /**
   * Set to `true` to skip signature verification.
   */
  skipVerify?: boolean
}
