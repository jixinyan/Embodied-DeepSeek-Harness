import { LlmAdapter, ToolCallId } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm';

export type ModelStep = (options: GenerateOptions) => AsyncIterable<StreamChunk>;

/** Keyless, synthetic model boundary. It never chooses or dispatches a tool. */
export class ScriptedModel extends LlmAdapter {
  readonly requests: GenerateOptions[] = [];
  private cursor = 0;
  constructor(private readonly script: readonly ModelStep[]) {
    super();
  }
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options);
    const step = this.script[this.cursor++];
    if (step === undefined) throw new Error('Unexpected model request: script exhausted.');
    yield* step(options);
  }
}

export function textResponse(text: string): ModelStep {
  return async function* () {
    yield { type: 'block-start', index: 0, blockType: 'text' };
    yield { type: 'text-delta', index: 0, text };
    yield { type: 'block-end', index: 0, block: { type: 'text', text } };
    yield { type: 'finish', reason: { kind: 'stop' } };
  };
}

export function toolResponse(name: string, args: object, id = 'scripted-call'): ModelStep {
  return async function* () {
    const callId = ToolCallId(id);
    const argumentsJson = JSON.stringify(args);
    yield { type: 'block-start', index: 0, blockType: 'tool-call' };
    yield { type: 'tool-call-delta', index: 0, id: callId, name, argumentsDelta: argumentsJson };
    yield {
      type: 'block-end',
      index: 0,
      block: { type: 'tool-call', id: callId, name, arguments: argumentsJson },
    };
    yield { type: 'finish', reason: { kind: 'tool-calls' } };
  };
}
