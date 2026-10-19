export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      uuid,
    )
  )
    return new Response("Invalid UUID", { status: 400 });
  try {
    const r = await fetch(
      `https://crafatar.com/avatars/${uuid}?size=64&overlay`,
      {
        redirect: "error",
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
      },
    );
    if (!r.ok || !r.headers.get("Content-Type")?.startsWith("image/"))
      throw Error();
    const bytes = await r.arrayBuffer();
    if (bytes.byteLength > 262144) throw Error();
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public,max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Skin unavailable", { status: 502 });
  }
}
