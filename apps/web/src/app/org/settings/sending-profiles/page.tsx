import { SendingProfilesClient } from "./sending-profiles-client";

export const metadata = {
  title: "Sending profiles",
  description: "Configure outbound from addresses for simulations.",
};

export default function SendingProfilesPage() {
  return <SendingProfilesClient />;
}
