import { Fragment } from "react";

/**
 * Minimal markdown-lite renderer for legal_documents.content — plain
 * text with just enough structure for a legal notice: blank-line-
 * separated paragraphs, "## " for a subheading, "- " lines grouped into
 * a bullet list. Deliberately not full markdown/HTML — the editor in
 * Beállítások is a plain textarea, so keeping the syntax this small
 * means what you type is exactly what you see, no hidden formatting to
 * get wrong. Returns real React elements (not dangerouslySetInnerHTML)
 * so there's no HTML-injection surface even though the content only
 * ever comes from an authenticated founder session.
 */
export default function LegalDocumentContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <>
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return <h2 key={i}>{block.slice(3)}</h2>;
        }
        const lines = block.split("\n");
        if (lines.every((l) => l.trim().startsWith("- "))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{l.trim().slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
