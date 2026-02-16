import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }> | { slug: string };
};

export default async function EventCalendarPage({ params }: PageProps) {
  const resolved = await params;
  redirect(`/eventos/${resolved.slug}`);
}
