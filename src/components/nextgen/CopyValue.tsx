import { useState } from "react";
export function CopyValue({
  value,
  label = "Copy value",
}: {
  value: string;
  label?: string;
}) {
  const [feedback, setFeedback] = useState("");
  return (
    <span className="copy-value">
      <code>{value}</code>
      <button
        className="button secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setFeedback("Copied");
          } catch {
            setFeedback("Copy unavailable; select the value above.");
          }
        }}
      >
        {label}
      </button>
      <span role="status">{feedback}</span>
    </span>
  );
}
