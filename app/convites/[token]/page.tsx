import InviteClient from "./InviteClient";

export default function ConvitePage({ params }: { params: { token: string } }) {
  return <InviteClient token={params.token} />;
}
