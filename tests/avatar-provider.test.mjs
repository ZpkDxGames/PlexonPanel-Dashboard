import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLAYER_HEAD_URL_TEMPLATE,
  avatarCspOrigin,
  buildPlayerHeadUrl,
  createAvatarProvider,
  normalizePlayerUuid,
  resolveAvatarProviderTemplate,
} from "../.test-dist/lib/avatar-provider.js";

const UUID_DASHED = "A0B1C2D3-E4F5-4678-9ABC-DEF012345678";
const UUID_PLAIN = "a0b1c2d3e4f546789abcdef012345678";

test("normalizes dashed and undashed UUIDs to lowercase hex", () => {
  assert.equal(normalizePlayerUuid(UUID_DASHED), UUID_PLAIN);
  assert.equal(normalizePlayerUuid(UUID_PLAIN.toUpperCase()), UUID_PLAIN);
  assert.equal(normalizePlayerUuid("not-a-uuid"), null);
  assert.equal(normalizePlayerUuid(""), null);
});

test("uses MCHeads when deployment does not configure an avatar template", () => {
  assert.equal(resolveAvatarProviderTemplate(undefined), DEFAULT_PLAYER_HEAD_URL_TEMPLATE);
  assert.equal(resolveAvatarProviderTemplate(""), DEFAULT_PLAYER_HEAD_URL_TEMPLATE);
  assert.equal(resolveAvatarProviderTemplate("disabled"), null);
  const provider = createAvatarProvider(resolveAvatarProviderTemplate(undefined), {
    production: true,
  });
  assert.ok(provider);
  assert.equal(provider.origin, "https://mc-heads.net");
  assert.equal(
    buildPlayerHeadUrl(provider, UUID_DASHED, 40),
    `https://mc-heads.net/avatar/${UUID_PLAIN}/40`,
  );
});

test("accepts one HTTPS uuid template and derives exact CSP origin", () => {
  const provider = createAvatarProvider(
    "https://avatars.example.test/avatar/{uuid}?size={size}&overlay=1",
    { production: true },
  );
  assert.ok(provider);
  assert.equal(provider.origin, "https://avatars.example.test");
  assert.equal(
    avatarCspOrigin(
      "https://avatars.example.test/avatar/{uuid}?size={size}&overlay=1",
      true,
    ),
    "https://avatars.example.test",
  );
  assert.equal(
    buildPlayerHeadUrl(provider, UUID_DASHED, 40),
    `https://avatars.example.test/avatar/${UUID_PLAIN}?size=40&overlay=1`,
  );
});

test("allows development HTTP only on loopback", () => {
  assert.ok(
    createAvatarProvider("http://localhost:3001/head/{uuid}/{size}", {
      production: false,
    }),
  );
  assert.equal(
    createAvatarProvider("http://localhost:3001/head/{uuid}", { production: true }),
    null,
  );
  assert.equal(
    createAvatarProvider("http://avatars.example.test/head/{uuid}", {
      production: false,
    }),
    null,
  );
});

test("rejects malformed, repeated, secret-bearing, fragment, and unsafe templates", () => {
  const invalid = [
    "https://avatars.example.test/head/static",
    "https://avatars.example.test/{uuid}/{uuid}",
    "https://avatars.example.test/{uuid}/{size}/{size}",
    "https://avatars.example.test/{player}",
    "https://user:pass@avatars.example.test/{uuid}",
    "https://avatars.example.test/{uuid}#fragment",
    "//avatars.example.test/{uuid}",
    "data:image/png,{uuid}",
    "blob:https://avatars.example.test/{uuid}",
    "javascript:{uuid}",
    "https://avatars.example.test/{uuid}\nInjected: yes",
  ];
  for (const template of invalid) {
    assert.equal(createAvatarProvider(template, { production: true }), null, template);
  }
});

test("rejects unsupported sizes and malformed UUIDs without producing a request URL", () => {
  const provider = createAvatarProvider("https://avatars.example.test/{uuid}?s={size}", {
    production: true,
  });
  assert.ok(provider);
  assert.equal(buildPlayerHeadUrl(provider, "bad", 40), null);
  assert.equal(buildPlayerHeadUrl(provider, UUID_PLAIN, 48), null);
  assert.equal(buildPlayerHeadUrl(null, UUID_PLAIN, 40), null);
});
