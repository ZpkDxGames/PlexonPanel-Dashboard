import assert from "node:assert/strict";
import test from "node:test";
import { parseTextFormat, plainText } from "../src/lib/textFormat";

test("ANSI 16, 256 and truecolor sequences become bounded segments", () => {
  const parts = parseTextFormat("\x1b[31mred\x1b[38;5;45mcyan\x1b[38;2;1;2;3mrgb\x1b[0m plain");
  assert.equal(plainText(parts), "redcyanrgb plain");
  assert.equal(parts[0].style.color, "#aa0000");
  assert.equal(parts[2].style.color, "rgb(1 2 3)");
});

test("legacy section codes support styles and hex while ampersands stay literal", () => {
  const parts = parseTextFormat("§aGreen §lBold §x§1§2§3§4§5§6Hex &cplain");
  assert.equal(plainText(parts), "Green Bold Hex &cplain");
  assert.equal(parts.at(-1)?.style.color, "#123456");
});

test("composer mode enables ampersand aliases", () => {
  const parts = parseTextFormat("&aHello &#ff00ffworld", { composer: true });
  assert.equal(plainText(parts), "Hello world");
  assert.equal(parts[0].style.color, "#55ff55");
});

test("MiniMessage styles, safe URLs and malformed tags remain inert", () => {
  const parts = parseTextFormat("<red><bold>Alert</bold></red> <click:open_url:'https://example.com'>site</click> <script>x</script>");
  assert.equal(plainText(parts), "Alert site <script>x</script>");
  assert.equal(parts.find((part) => part.text === "site")?.interaction?.kind, "open_url");
  assert.match(plainText(parseTextFormat("<click:open_url:'javascript:alert(1)'>bad</click>")), /bad/);
  assert.equal(parseTextFormat("<red>open").at(-1)?.style.color, "#ff5555");
});

test("format parser caps adversarial input and tag volume", () => {
  const parts = parseTextFormat("<bold>".repeat(200) + "x".repeat(30000));
  assert.ok(plainText(parts).length <= 20000);
  assert.ok(parts.length <= 66);
});
