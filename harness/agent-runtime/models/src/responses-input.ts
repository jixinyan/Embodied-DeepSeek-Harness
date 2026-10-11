import type { ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment';
import { LlmError, type ContentBlock, type GenerateOptions } from '@deepseek-ai/dsh-llm';
import {
  assertSameModelImageReference,
  resolveModelImage,
  type ModelImageResolver,
} from './model-images.js';
import { responsesReplayOutput } from './responses-function-calls.js';

export interface ResponsesInputOptions {
  readonly resolveImage?: ModelImageResolver;
  readonly maxImagesPerRequest: number;
  readonly maxRequestBytes: number;
}
type ResponsesItem = Record<string, unknown>;
const text = (blocks: readonly ContentBlock[]) =>
  blocks
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('');

export async function responsesInputItems(
  options: GenerateOptions,
  config: ResponsesInputOptions,
  signal: AbortSignal,
): Promise<ResponsesItem[]> {
  signal.throwIfAborted();
  if (
    !Number.isSafeInteger(config.maxImagesPerRequest) ||
    config.maxImagesPerRequest <= 0 ||
    !Number.isSafeInteger(config.maxRequestBytes) ||
    config.maxRequestBytes <= 0
  )
    throw new LlmError('Responses input limits are invalid.', 'INVALID_REQUEST');
  const items: ResponsesItem[] = [];
  const images = new Map<ImageAttachmentRef['attachmentId'], RequestImageAttachment>();
  let imageCount = 0;
  let imageBytes = 0;
  const blocks = async (content: readonly ContentBlock[]): Promise<ResponsesItem[]> => {
    const result: ResponsesItem[] = [];
    for (const block of content) {
      signal.throwIfAborted();
      if (block.type === 'text') result.push({ type: 'input_text', text: block.text });
      else if (block.type === 'image') {
        if (++imageCount > config.maxImagesPerRequest)
          throw new LlmError('Request image count exceeded.', 'INVALID_REQUEST');
        let image = images.get(block.attachment.attachmentId);
        if (image) assertSameModelImageReference(block.attachment, image.attachment);
        else {
          image = await resolveModelImage(
            block.attachment,
            config.resolveImage,
            signal,
            config.maxRequestBytes - imageBytes,
          );
          images.set(block.attachment.attachmentId, image);
        }
        imageBytes += Math.ceil(image.bytes / 3) * 4;
        if (imageBytes > config.maxRequestBytes)
          throw new LlmError('Request image bytes exceeded.', 'INVALID_REQUEST');
        result.push({
          type: 'input_image',
          image_url: `data:${image.mediaType};base64,${Buffer.from(image.data).toString('base64')}`,
        });
      } else if (block.type === 'tool-result') result.push(...(await blocks(block.content)));
    }
    return result;
  };
  for (const message of options.messages) {
    signal.throwIfAborted();
    if (message.role === 'system') continue;
    const toolCalls = message.content.filter(
      (block): block is Extract<ContentBlock, { type: 'tool-call' }> => block.type === 'tool-call',
    );
    if (message.role === 'assistant') {
      const replay = message.source.kind === 'model' && message.source.replayState;
      const replayResponse =
        replay && typeof replay === 'object' && 'response' in replay ? replay.response : undefined;
      if (
        replayResponse &&
        typeof replayResponse === 'object' &&
        Array.isArray((replayResponse as { output?: unknown }).output)
      ) {
        items.push(...responsesReplayOutput(replayResponse, toolCalls));
        continue;
      }
      for (const call of toolCalls)
        items.push({
          type: 'function_call',
          call_id: call.id,
          name: call.name,
          arguments: call.arguments,
        });
      const parts = await blocks(message.content.filter((block) => block.type !== 'tool-call'));
      if (parts.length) items.push({ role: 'assistant', content: parts });
      continue;
    }
    const results = message.content.filter(
      (block): block is Extract<ContentBlock, { type: 'tool-result' }> =>
        block.type === 'tool-result',
    );
    const parts = await blocks(message.content.filter((block) => block.type !== 'tool-result'));
    if (parts.length) items.push({ role: 'user', content: parts });
    for (const result of results) {
      const output = await blocks(result.content);
      items.push({
        type: 'function_call_output',
        call_id: result.toolCallId,
        output: output.some((part) => part.type === 'input_image')
          ? output
          : text(result.content) || '(no output)',
      });
    }
  }
  return items;
}
