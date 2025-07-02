import type { messagingApi } from '@line/bot-sdk'
import { kRawBody } from './symbols.js'

declare module 'fastify' {
  interface FastifyInstance {
    line: messagingApi.MessagingApiClient
  }

  interface FastifyRequest {
    [kRawBody]: string
  }

  interface FastifyContextConfig {
    lineWebhook?: boolean
  }
}

export interface FastifyLineOptions {
  channelSecret: string
  channelAccessToken: string
}
