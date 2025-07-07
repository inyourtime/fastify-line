# fastify-line

[![CI](https://github.com/inyourtime/fastify-line/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/inyourtime/fastify-line/actions/workflows/ci.yml)
[![NPM version](https://img.shields.io/npm/v/fastify-line.svg?style=flat)](https://www.npmjs.com/package/fastify-line)
[![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](./LICENSE)

A Fastify plugin for seamless integration with the [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/overview/). It provides signature verification, raw body parsing, and exposes the official LINE Messaging API client on your Fastify instance.

---

## Features

- Signature verification for LINE webhooks
- Raw body parsing for webhook requests
- Exposes the official `@line/bot-sdk` Messaging API client as `fastify.line`
- Easy route integration with Fastify

## Installation

```bash
npm install fastify-line @line/bot-sdk
```

> **Note:** `@line/bot-sdk` is a peer dependency and must be installed separately.

## Compatibility

| Plugin Version | Fastify Version |
|:--------------:|:---------------:|
| `>=0.x`        | `^5.x`          |

## Usage

Register the plugin with your LINE channel credentials:

```ts
import Fastify from 'fastify'
import fastifyLine, { type WebhookRequestBody } from 'fastify-line'

const fastify = Fastify()

await fastify.register(fastifyLine, {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
})

fastify.post<{ Body: WebhookRequestBody }>(
  '/webhook',
  {
    config: { lineWebhook: true }, // Enable LINE webhook handling for this route
  },
  async (request, reply) => {
    const { events } = request.body

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        await fastify.line.replyMessage({
          replyToken: event.replyToken,
          messages: [
            {
              type: 'text',
              text: `You said: ${event.message.text}`,
            },
          ],
        })
      }
    }

    reply.send({ ok: true })
  },
)

await fastify.listen({ port: 3000 })
```

### Skip Signature Verification

```ts
await fastify.register(fastifyLine, {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  skipVerify: true, // Skip signature verification
})
```

## Options

| Option               | Type     | Required | Default | Description                                                      |
|----------------------|----------|----------|---------|------------------------------------------------------------------|
| `channelSecret`      | string   | Yes      | -       | Your LINE channel secret (for signature verification)            |
| `channelAccessToken` | string   | Yes      | -       | Your LINE channel access token (for Messaging API client)        |
| `skipVerify`         | boolean  | No       | `false` | Skip signature verification                                      |

## How It Works

- Adds a `line` property to your Fastify instance: `fastify.line` (an instance of `MessagingApiClient` from `@line/bot-sdk`).
- For routes with `config: { lineWebhook: true }`:
  - Parses the raw request body.
  - Verifies the `X-Line-Signature` header using your channel secret.
  - Throws `MissingSignatureError` or `InvalidSignatureError` if verification fails.

## Error Handling

The plugin throws custom errors for signature issues:

- `MissingSignatureError`: Thrown if the `X-Line-Signature` header is missing.
- `InvalidSignatureError`: Thrown if the signature is invalid.

You can handle these errors using Fastify's error handler:

```ts
fastify.setErrorHandler((err, _request, reply) => {
  if (err instanceof MissingSignatureError) {
    reply.status(401).send({
      error: err.message,
      message: 'The X-Line-Signature header is missing.',
    })
  }

  if (err instanceof InvalidSignatureError) {
    reply.status(401).send({
      error: err.message,
      message: 'The X-Line-Signature header is invalid.',
      signature: err.signature,
    })
  }

  // Default error handling
  reply.send(err)
})
```

## Types

This plugin augments Fastify's types:

- `fastify.line`: The LINE Messaging API client
- `config.lineWebhook`: Set to `true` on a route to enable LINE webhook handling

## Contributing

Contributions are welcome!

## License

MIT
