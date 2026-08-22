export function ExtractedText({ text }: { text: string }) {
  const characterCount = Array.from(text).length;

  return (
    <section className="extracted-text" aria-labelledby="extracted-text-heading">
      <p className="section-label">Source check</p>
      <h2 id="extracted-text-heading">Extracted text</h2>
      <p>
        Review the raw extraction before generating study material. This text stays
        on this device.
      </p>
      <details open>
        <summary>
          Extracted text preview <span>({characterCount.toLocaleString()} characters)</span>
        </summary>
        <pre>{text}</pre>
      </details>
    </section>
  );
}
