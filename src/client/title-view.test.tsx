import { expect, test } from "bun:test";
import { NativeImage } from "@opentui/core";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { TitleView } from "./views/title.tsx";

test("title screen renders the logo badge and the start prompt", async () => {
  const badge = await NativeImage.load(new URL("../../assets/troops/caballero-coin-mediano.png", import.meta.url).toString());
  const setup = await testRender(<TitleView source={badge} />, { width: 70, height: 24 });
  try {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await setup.renderOnce();
      await setup.flush({ maxPasses: 20 });
    });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("EMPEZAR");
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(0); // badge block pixels
  } finally {
    setup.renderer.destroy();
    badge.dispose();
  }
});

test("title screen falls back to ASCII art when the badge fails to load", async () => {
  const setup = await testRender(<TitleView source="assets/troops/no-such-badge.png" />, { width: 70, height: 24 });
  try {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      await setup.flush({ maxPasses: 20 });
    });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("EMPEZAR");
    expect(frame).toContain("W A R   C H E S T");
  } finally {
    setup.renderer.destroy();
  }
});