import { Effect, Schema } from "effect"
import type { ProviderPackage } from "../provider-package.js"
import { OpenAIChat } from "../protocols/openai-chat.js"
import { ProviderShared } from "../protocols/shared.js"
import { OpenResponsesOptions } from "../protocols/utils/open-responses-options.js"
import { AuthOptions, type ProviderAuthOption } from "../route/auth-options.js"
import { Route, type RouteDefaultsInput } from "../route/client.js"
import { Endpoint } from "../route/endpoint.js"
import { Protocol } from "../route/protocol.js"
import { ProviderID, type ModelID, type LLMRequest } from "../schema/index.js"

export const id = ProviderID.make("groq")
const baseURL = "https://api.groq.com/openai/v1"

const Options = Schema.Struct({
  reasoningEffort: Schema.optional(OpenResponsesOptions.ReasoningEffort),
  /** Controls visible reasoning on GPT-OSS; other models always use parsed reasoning. */
  includeReasoning: Schema.optional(Schema.Boolean),
  parallelToolCalls: Schema.optional(Schema.Boolean),
  serviceTier: Schema.optional(ProviderShared.knownString<"on_demand" | "flex" | "auto" | "performance">()),
  user: Schema.optional(Schema.String),
})
export type ProviderOptions = typeof Options.Type
const decodeOptions = ProviderShared.validateWith(Schema.decodeUnknownEffect(Options))

export type LanguageModelOptions = Omit<RouteDefaultsInput, "providerOptions"> &
  ProviderAuthOption<"optional"> & {
    readonly baseURL?: string
    readonly providerOptions?: ProviderOptions
  }

export type Settings = ProviderPackage.Settings &
  ProviderOptions & {
    readonly apiKey?: string
    readonly baseURL?: string
  }

export const protocol = Protocol.make({
  id: "groq-chat",
  body: {
    schema: Schema.Struct({
      ...OpenAIChat.bodyFields,
      reasoning_format: Schema.optional(Schema.Literal("parsed")),
      include_reasoning: Options.fields.includeReasoning,
      parallel_tool_calls: Options.fields.parallelToolCalls,
      service_tier: Options.fields.serviceTier,
      user: Options.fields.user,
    }),
    from: Effect.fn("Groq.fromRequest")(function* (request: LLMRequest) {
      const options = yield* decodeOptions(request.providerOptions ?? {})
      const gptOSS = request.model.id.startsWith("openai/gpt-oss-")
      return {
        ...(yield* OpenAIChat.fromRequest(request)),
        reasoning_format: gptOSS ? undefined : ("parsed" as const),
        include_reasoning: gptOSS ? options.includeReasoning : undefined,
        parallel_tool_calls: options.parallelToolCalls,
        service_tier: options.serviceTier,
        user: options.user,
      }
    }),
  },
  stream: OpenAIChat.protocol.stream,
})

export const route = Route.make({
  id: "groq-chat",
  provider: id,
  providerMetadataKey: "groq",
  protocol,
  endpoint: Endpoint.path("/chat/completions", { baseURL }),
  framing: OpenAIChat.framing,
})

export const configure = (input: LanguageModelOptions = {}) => {
  const { apiKey: _apiKey, auth: _auth, baseURL: endpoint, ...defaults } = input
  const configured = route.with({
    ...defaults,
    endpoint: { baseURL: endpoint ?? baseURL },
    auth: AuthOptions.bearer(input, "GROQ_API_KEY"),
  })
  return {
    id,
    model: (modelID: string | ModelID) =>
      configured.model<ProviderOptions>({
        id: modelID,
        compatibility: {
          maxTokensField: "max_completion_tokens",
          reasoningField: "reasoning",
          requireReasoning: false,
          supportsStrictMode: false,
        },
      }),
    configure,
  }
}

export const provider = configure()

export const model: ProviderPackage.Definition<Settings, ProviderOptions>["model"] = (
  modelID,
  { apiKey, baseURL, body, headers, ...providerOptions },
) =>
  configure({
    apiKey,
    baseURL,
    headers,
    http: body === undefined ? undefined : { body },
    providerOptions,
  }).model(modelID)

export * as Groq from "./groq.js"
