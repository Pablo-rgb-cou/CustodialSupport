import SignupFlow from "./SignupFlow";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string | string[] }>;
}) {
  const params = await searchParams;
  // Keep older verification links working while new signups use /verify-email.
  return <SignupFlow verificationOnly={params.verify === "1"} />;
}
