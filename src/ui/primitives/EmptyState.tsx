import { Inbox } from "lucide-react";
import { IconBadge } from "./IconBadge";
export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="pp-well empty-state">
      <IconBadge icon={Inbox} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
