import ChargeClient from "./ChargeClient";

export default function CobrancaPage({ params }: { params: { token: string } }) {
  return <ChargeClient token={params.token} />;
}
