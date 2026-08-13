import { notFound, redirect } from "next/navigation";
import { isReservedRootPath } from "@/lib/routes";

type Props = { params: Promise<{ categorySlug: string }> };

export default async function LegacyCategoryPage({ params }: Props) {
  const { categorySlug } = await params;

  if (isReservedRootPath(categorySlug)) {
    notFound();
  }

  redirect(`/produtos/${categorySlug}`);
}
