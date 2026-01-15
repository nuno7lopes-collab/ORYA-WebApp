import { redirect } from "next/navigation";

export default function PadelDuplasRedirect() {
  redirect("/social?tab=notifications");
}
