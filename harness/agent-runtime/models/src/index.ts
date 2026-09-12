// Architecture contract only. No runtime implementation.
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
