import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { visit } from 'unist-util-visit';
import type { SkillSelection } from './index.js';

export const SKILL_SECTIONS = [
  'When to use',
  'Failure signals',
  'Possible causes',
  'Avoid',
  'Planning guidance',
  'Verification guidance',
  'Limits',
  'Source',
] as const;
const retainedSections = ['When to use', 'Limits', 'Source'];
type Root = ReturnType<typeof fromMarkdown>;
type Block = Root['children'][number];
type Section = { name: string; start: number; end: number; nodes: Block[] };

function offset(node: Block): number {
  const value = node.position?.start.offset;
  if (value === undefined) throw new Error('Skill Markdown source position is unavailable.');
  return value;
}

export function skillSections(markdown: string) {
  if (typeof markdown !== 'string' || !markdown.trim() || Buffer.byteLength(markdown) > 64 * 1024)
    throw new Error('Invalid skill content.');
  const tree = fromMarkdown(markdown);
  const sections: Section[] = [];
  let current: Section | undefined;
  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth <= 2) {
      if (current) current.end = offset(node);
      current = undefined;
      if (node.depth === 2) {
        if (node.children.length !== 1 || node.children[0]?.type !== 'text')
          throw new Error('Skill section headings must contain a plain section name.');
        const name = node.children[0].value;
        if (sections.some((section) => section.name === name))
          throw new Error(`Duplicate skill section: ${name}`);
        current = { name, start: offset(node), end: markdown.length, nodes: [] };
        sections.push(current);
      }
    }
    current?.nodes.push(node);
  }
  for (const name of SKILL_SECTIONS) {
    const section = sections.find((value) => value.name === name);
    if (!section) throw new Error(`Skill requires section: ${name}`);
    if (section.nodes.length < 2) throw new Error(`Skill section is empty: ${name}`);
  }
  return { tree, sections };
}

export function selectSkillSections(
  markdown: string,
  requested: readonly string[],
): { markdown: string; selection: SkillSelection } {
  const { tree, sections } = skillSections(markdown);
  if (
    !Array.isArray(requested) ||
    !requested.length ||
    requested.length > 32 ||
    new Set(requested).size !== requested.length ||
    requested.some(
      (name) => typeof name !== 'string' || !sections.some((section) => section.name === name),
    )
  )
    throw new Error('Choose distinct section names present in this skill.');
  const names = new Set([...requested, ...retainedSections]);
  const included = sections.filter((section) => names.has(section.name));
  const preambleEnd = sections[0]!.start;
  const ranges = [{ start: 0, end: preambleEnd }, ...included];
  const selected: Root = {
    type: 'root',
    children: tree.children.filter((node) =>
      ranges.some((range) => offset(node) >= range.start && offset(node) < range.end),
    ),
  };
  const references = new Set<string>();
  visit(selected, (node) => {
    if (node.type === 'linkReference' || node.type === 'imageReference')
      references.add(node.identifier);
  });
  const seen = new Set<string>();
  const definitions: Block[] = [];
  visit(tree, 'definition', (node) => {
    if (seen.has(node.identifier)) return;
    seen.add(node.identifier);
    if (
      references.has(node.identifier) &&
      !ranges.some((range) => offset(node) >= range.start && offset(node) < range.end)
    )
      definitions.push(node);
  });
  const selectedMarkdown = [
    ...(definitions.length ? [toMarkdown({ type: 'root', children: definitions })] : []),
    ...ranges.map((range) => markdown.slice(range.start, range.end)),
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    markdown: selectedMarkdown,
    selection: {
      fullDocument: false,
      requestedSections: [...requested],
      includedSections: included.map((section) => section.name),
      omittedSections: sections
        .filter((section) => !names.has(section.name))
        .map((section) => section.name),
      sourceBytes: Buffer.byteLength(markdown),
      returnedBytes: Buffer.byteLength(selectedMarkdown),
    },
  };
}
