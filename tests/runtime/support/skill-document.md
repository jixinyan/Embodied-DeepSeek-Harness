# Inspecting a selected document section

This authored document describes Markdown inspection. No model or physical provider
produced the document, and its metadata references are document-reader test inputs.

## When to use

Use this guidance when selecting part of a Markdown document for a focused question.

## Failure signals

The excerpt omits an applicability condition, loses a link target or includes a heading
that belongs to a fenced example.

## Possible causes

Text matching alone can confuse headings with quoted examples. A link definition can
appear in a different section from its reference.

## Avoid

Do not treat an excerpt as the complete document. Preserve the original immutable text.

## Planning guidance

Read the document outline and select sections relevant to the current question.

### Example content

```markdown
## Verification guidance
This heading belongs to the example code block.
```

## Verification guidance

Check that the selected section preserves its nested content and applicable limitations.
Compare the excerpt's included and omitted section lists with the current question.

## Limits

This document describes text selection only. It establishes no physical task result.

## Source

Authored project documentation for parser, persistence and native tool acceptance.
