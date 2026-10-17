import Link from "next/link";
export default function Page() {
  return (
    <main className="workspace">
      <h1>Workspace not found</h1>
      <Link href="/overview">Open overview</Link>
    </main>
  );
}
