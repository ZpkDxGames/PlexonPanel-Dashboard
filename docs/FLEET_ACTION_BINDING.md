# Fleet action and confirmation binding

Each selected authenticated Dashboard socket has a serverId and a local connection generation.
The generation changes on transport replacement or changes to agent sessions, source presence,
device grant or capabilities. Actions capture this target before asynchronous confirmation.
Sending after any target change fails without transmitting to the replacement server. Dialogs
show the server name and immutable short UUID; switching, reconnecting and signing out cancel
them. Confirmation parameters are copied before review.

Pending completions retain their original socket, server, generation, action and agent authority.
Substituted completions cannot resolve the operation. Relay queue acknowledgements remain distinct
from completion and never claim execution. New relay acknowledgements/rejections include serverId;
legacy relay messages without it are accepted only when received from the original authenticated
socket. Uncertain operations are never replayed automatically.

Selecting a server disables actions and clears visible state synchronously before browser storage
or reconnection work. Late messages from the previous selected server cannot rebind its actions
or populate the new workspace. Existing per-server credential and cache keys remain unchanged.

Executed regression tests cover a confirmation paused across A-to-B selection, agent replacement
on the same Dashboard transport, mismatched server/socket/action/source completions and legacy
rejection handling. Live two-server browser and production denial testing remain separate gates.
