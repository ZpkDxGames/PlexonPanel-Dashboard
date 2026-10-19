import { chipTone } from "./parse-line";
export const PluginChip = ({ tag }: { tag: string }) => (
  <span
    title={tag}
    data-tone={chipTone(tag)}
    className="plugin-chip max-w-full inline-flex h-[17px] items-center rounded-[5px] border border-[rgb(var(--tone)/.26)] bg-[rgb(var(--tone)/.10)] px-1.5 text-[11px] font-medium text-[rgb(var(--tone))]"
  >
    <span className="truncate">{tag}</span>
  </span>
);
