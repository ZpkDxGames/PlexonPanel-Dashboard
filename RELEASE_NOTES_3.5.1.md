# PlexonPanel Dashboard 3.5.1

Dashboard 3.5.1 makes the Host-owned backup pipeline observable without weakening its safety boundary.

- Shows a full-width live progress bar while the Host reads and compresses source data into the ZIP.
- Shows rclone-transferred ZIP bytes, total bytes, percentage, and current transfer rate during Google Drive upload.
- Keeps remote verification and canonical promotion distinct from transfer completion.
- Shows the final temporary-VPS-ZIP cleanup phase and reports whether that local file was released or retained with a warning.
- Updates backup history to distinguish a retained VPS copy from an intentionally released temporary ZIP while preserving the verified Google Drive record.
- Keeps progress bound to the matching durable Host job so a stale event cannot be displayed for a later operation.

Protocol remains 3. Existing identities, browser credentials, device grants, action scopes, and `/v1` routes are unchanged.
