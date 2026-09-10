import MacroApp from "@/components/MacroApp";
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <MacroApp view="country" initialCountry={code.toUpperCase()} />;
}
