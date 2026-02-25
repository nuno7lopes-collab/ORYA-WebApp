import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("event detail layout contract", () => {
  it("usa layout split, cta de bilhetes e descrição expandível", () => {
    const source = readLocal("app/eventos/[slug]/page.tsx");

    expect(source).toContain('data-testid="event-detail-dice-split"');
    expect(source).toContain('id="bilhetes"');
    expect(source).toContain("ticketCopy.viewLabel");
    expect(source).toContain("href={googleMapsUrl}");
    expect(source).toContain("EventDescriptionReadMore");
  });
});
