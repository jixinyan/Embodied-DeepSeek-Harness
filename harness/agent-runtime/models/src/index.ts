export interface ModelCapabilities {
  readonly images: boolean;
  readonly toolCalls: boolean;
  readonly streaming: boolean;
}
export interface ModelBinding {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly capabilities: ModelCapabilities;
}
export interface ModelRegistry {
  resolve(binding: string): Promise<ModelBinding>;
}

export {
  OpenAICompatibleAdapter,
  type OpenAICompatibleOptions,
  type OpenAICompatibleModel,
} from './openai-compatible.js';
export {
  OpenAIResponsesAdapter,
  type OpenAIResponsesOptions,
  type OpenAIResponsesModel,
} from './openai-responses.js';
export {
  createConfiguredModels,
  parseModelConfiguration,
  readModelConfiguration,
  type ModelConfiguration,
} from './configuration.js';
