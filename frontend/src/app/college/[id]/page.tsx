import CollegeDetailClient from "./CollegeDetailClient";
import { COLLEGE_CODES } from "@/lib/collegeCodes";

export const dynamicParams = false;

export function generateStaticParams() {
  return COLLEGE_CODES.map((id) => ({ id }));
}

export default async function CollegeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollegeDetailClient id={id} />;
}
