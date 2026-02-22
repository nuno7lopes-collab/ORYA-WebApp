import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const checkoutPath = resolve(process.cwd(), "app/checkout/index.tsx");

describe("checkout mbway contract", () => {
  it("desativa MBWay no Expo Go e mostra mensagem explícita", () => {
    const file = readFileSync(checkoutPath, "utf8");
    expect(file).toContain("Constants.appOwnership === \"expo\"");
    expect(file).toContain("Constants.executionEnvironment === \"storeClient\"");
    expect(file).toContain("const allowMbwayInApp = !isExpoGo;");
    expect(file).toContain("CHECKOUT_MBWAY_EXPO_GO_ERROR");
  });

  it("usa timeout/polling próprios para MBWay em requires_action", () => {
    const file = readFileSync(checkoutPath, "utf8");
    expect(file).toContain("CHECKOUT_AUTOPOLL_TIMEOUT_MBWAY_MS");
    expect(file).toContain("CHECKOUT_POLL_INTERVAL_REQUIRES_ACTION_MBWAY_MS");
    expect(file).toContain("resolvedMethod === \"mbway\"");
    expect(file).toContain("Aguarda confirmação MBWay");
  });
});
