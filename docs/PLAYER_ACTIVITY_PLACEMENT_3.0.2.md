# Player Activity Placement — Dashboard 3.0.2

Recent browser-local player join/leave activity now belongs to the **Players** workspace rather than the Overview dashboard.

## Presentation

- Overview no longer presents the Recent activity card.
- Players includes a dedicated Recent player activity panel beneath the roster/history workspace.
- The panel shows stored event, join, leave, and unique-player counts plus the most recent join/leave rows with player heads.
- The existing browser-local activity-history dialog is opened from Players.

## Authority boundaries

Browser-local activity and Paper-owned persistent history remain separate:

- Browser-local activity is captured from authorized presence events and retained in local browser storage.
- Paper-owned history continues to use `players.history.list` only when the device scope and local Paper capability allow it.
- Disabling Paper player history does not erase or disable the browser-local recent activity feed.
- No protocol, relay, scope, or action semantics are changed by this placement update.
