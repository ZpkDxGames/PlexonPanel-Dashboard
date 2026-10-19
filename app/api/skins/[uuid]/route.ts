import {
  validUuid,
  validTexture,
  validUsername,
  skinProxyTargets,
} from "../../../../src/ui/bindings/skins";
const LIMIT = 262144;
async function boundedPng(response: Response) {
  if (
    !response.ok ||
    !/^image\/png(?:;|$)/i.test(response.headers.get("content-type") ?? "") ||
    Number(response.headers.get("content-length")) > LIMIT ||
    !response.body
  )
    throw new Error("Avatar unavailable");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > LIMIT) throw new Error("Avatar too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    throw new Error("Invalid PNG");
  return bytes;
}
/** Identities only influence paths on fixed trusted HTTPS hosts; redirects are rejected. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await params,
    query = new URL(request.url).searchParams,
    name = query.get("name") ?? "",
    texture = query.get("texture") ?? "",
    rawSize = query.get("size") ?? "64",
    size = Number(rawSize);
  if (
    !(validUuid(uuid) || validTexture(uuid) || validUsername(uuid)) ||
    (query.has("name") && !validUsername(name)) ||
    (query.has("texture") && !validTexture(texture)) ||
    !/^\d{1,3}$/.test(rawSize) ||
    size < 8 ||
    size > 256
  )
    return new Response("Invalid skin identity or parameters", { status: 400 });
  const deadline = Date.now() + 6000;
  for (const url of skinProxyTargets(uuid, name, texture, size)) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const response = await fetch(url, {
          redirect: "error",
          signal: AbortSignal.timeout(Math.min(2000, remaining)),
          cache: "no-store",
        }),
        bytes = await boundedPng(response);
      return new Response(bytes, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      /* Continue within the total bounded provider budget. */
    }
  }
  return new Response("Skin unavailable", { status: 502 });
}
