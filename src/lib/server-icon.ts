import { preferences } from "../store/preferences";
import { session } from "../adapter/session";
/** Accept only the server's 64px PNG, never an external icon URL or active markup. */
export async function saveServerIcon(blob: Blob, serverId: string) {
  const header = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  if (
    blob.size > 256 * 1024 ||
    header.length < 24 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => header[i] === n)
  )
    throw new Error("Choose a PNG server icon under 256 KiB.");
  const view = new DataView(header.buffer);
  if (view.getUint32(16) !== 64 || view.getUint32(20) !== 64)
    throw new Error("Minecraft server icons must be 64 × 64 pixels.");
  const image = await createImageBitmap(blob);
  image.close();
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The icon could not be read."));
    reader.readAsDataURL(new Blob([blob], { type: "image/png" }));
  });
  if (session.getSnapshot().state.serverId !== serverId)
    throw new Error("The selected server changed. Choose its icon again.");
  preferences.update({
    serverIcons: { ...preferences.getSnapshot().serverIcons, [serverId]: data },
  });
}
