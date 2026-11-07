import { MspClient } from "./msp-client";

export const metadata = {
  title: "MSP",
  description: "MSP workspace to provision and open client organizations.",
};

export default function MspPage() {
  return <MspClient />;
}
