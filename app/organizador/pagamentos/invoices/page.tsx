import { redirect } from "next/navigation";

export const metadata = {
  title: "Faturação | ORYA",
};

export default function InvoicesPage() {
  redirect("/organizador?tab=invoices");
}
