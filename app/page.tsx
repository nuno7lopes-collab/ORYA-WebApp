import { redirect } from "next/navigation";
import DescobrirPage from "./descobrir/page";

type RootRedirectProps = Parameters<typeof DescobrirPage>[0];

export default async function RootRedirectPage(props: RootRedirectProps) {
  if (process.env.NODE_ENV === "production") {
    redirect("/descobrir");
  }
  return <DescobrirPage {...props} />;
}
