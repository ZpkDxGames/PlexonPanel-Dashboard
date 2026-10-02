# Fleet telemetry authority

Minecraft service status uses the existing `state` field from the Host's fixed-unit `systemctl show` adapter. Fleet cards consume this field for active/inactive status and the Paper-offline explanation. The regression fixture follows the real Host field name.

Both relay cores require authenticated Host authority for service status, including legacy agents. A 5.0.0 Host must bind service telemetry to its signed node ID and report the Minecraft-service/systemd-cgroup/percent-of-one-core resource contract. Node system telemetry also requires the source role matching the authenticated agent kind and the declared node scope. Paper cannot impersonate Host service accounting. The browser reducer independently refuses Paper-origin service status and drops old Host-session messages.

Legacy Host 3.x/4.x telemetry without the new fields remains readable. These additions do not change Protocol 3 or activate version 5. Tests cover the shared validators plus signed Worker-room delivery and source impersonation denial. Actual deployed multi-server/systemd accounting certification remains separate.

## Component compatibility

Protocol 3 remains additive. Rooms containing only legacy 3.x/4.x agents retain their existing behavior. Once either agent advertises 5.0.0, Paper controls require the authenticated 5.0 Paper identity; Host controls require both stored component identities to advertise exactly 5.0.0 and share the same immutable server/node/instance binding. Previously authenticated legacy sockets cannot receive Host actions or publish service status into the migrated workspace. Legacy reconnection/downgrade is rejected after a 5.0 association.

A new 5.0 component may authenticate while the counterpart is still legacy to permit staged provisioning, but the relay publishes target compatibility flags and blocks incompatible actions before recording pending work. The Dashboard disables those targets and cancels a pending confirmation when compatibility changes. Signed stored identities survive a normal Paper disconnect, allowing a correctly bound Host to start its stopped service. These flags express compatibility, not live operating-system state.

Fleet protocol violations use a typed rejection shared by Worker and standalone runtimes; an authenticated malformed or forged fleet event closes the socket instead of being mistaken for an internal post-authentication failure. Automated tests include mixed-version action denial, Paper-only operation during provisioning, source impersonation denial, and Host start after Paper disconnect. Production runtime certification remains NOT_EXECUTED for these additions.
