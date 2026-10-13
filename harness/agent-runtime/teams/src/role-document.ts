import { fromMarkdown } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { frontmatter } from 'micromark-extension-frontmatter';

export function readRoleDocument(
  markdown: string,
  location: string,
): { frontmatter: string; instructions: string } {
  // micromark 会移除开头的 BOM；正文位置使用相同的 source。
  const source = markdown.charCodeAt(0) === 0xfeff ? markdown.slice(1) : markdown;
  const document = fromMarkdown(source, {
    extensions: [frontmatter(['yaml'])],
    mdastExtensions: [frontmatterFromMarkdown(['yaml'])],
  });
  const metadata = document.children[0];
  if (metadata?.type !== 'yaml' || metadata.position?.end.offset === undefined)
    throw new Error(`Role requires YAML frontmatter and instructions: ${location}`);
  const instructions = source.slice(metadata.position.end.offset).trim();
  if (!instructions) throw new Error(`Role requires nonblank instructions: ${location}`);
  return { frontmatter: metadata.value, instructions };
}
