type SourceLabelProps = {
  sourceKind: "source" | "additional_example";
};

export function SourceLabel({ sourceKind }: SourceLabelProps) {
  return (
    <span className={`source-label source-label-${sourceKind}`}>
      {sourceKind === "source" ? "From lesson" : "Additional example"}
    </span>
  );
}
