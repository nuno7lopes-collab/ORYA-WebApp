import { buildMapTargets } from "../lib/mapLinks";

describe("mapLinks.buildMapTargets", () => {
  it("gera targets por query quando não há coordenadas", () => {
    const targets = buildMapTargets({
      label: "ORYA",
      query: "Rua da Trindade 1, Porto",
      lat: null,
      lng: null,
    });

    expect(targets).toEqual({
      apple: "https://maps.apple.com/?q=Rua%20da%20Trindade%201%2C%20Porto",
      android: "geo:0,0?q=Rua%20da%20Trindade%201%2C%20Porto",
      web: "https://www.google.com/maps/search/?api=1&query=Rua%20da%20Trindade%201%2C%20Porto",
    });
  });

  it("gera targets por coordenadas quando lat/lng são válidas", () => {
    const targets = buildMapTargets({
      label: "Pavilhão ORYA",
      query: null,
      lat: 41.14961,
      lng: -8.61099,
    });

    expect(targets).toEqual({
      apple: "https://maps.apple.com/?ll=41.14961,-8.61099&q=Pavilh%C3%A3o%20ORYA",
      android: "geo:41.14961,-8.61099?q=41.14961,-8.61099(Pavilh%C3%A3o%20ORYA)",
      web: "https://www.google.com/maps/search/?api=1&query=41.14961,-8.61099",
    });
  });

  it("faz fallback para query quando coordenadas estão fora de intervalo", () => {
    const targets = buildMapTargets({
      label: "ORYA",
      query: "Lisboa",
      lat: 190,
      lng: -8.6,
    });

    expect(targets).toEqual({
      apple: "https://maps.apple.com/?q=Lisboa",
      android: "geo:0,0?q=Lisboa",
      web: "https://www.google.com/maps/search/?api=1&query=Lisboa",
    });
  });

  it("devolve null quando não há query nem coordenadas válidas", () => {
    expect(
      buildMapTargets({
        label: "ORYA",
        query: "   ",
        lat: null,
        lng: null,
      }),
    ).toBeNull();
  });
});
