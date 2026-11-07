import { MfaSetupClient } from "./mfa-client";

export const metadata = {
  title: "MFA setup",
  description: "Enable authenticator MFA for your admin account.",
};

export default function MfaSetupPage() {
  return <MfaSetupClient />;
}
