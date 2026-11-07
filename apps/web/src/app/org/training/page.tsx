import dynamic from "next/dynamic";
import { MinimalLoader } from "@/components/ui/minimal-loader";

const TrainingHubClient = dynamic(
  () =>
    import("./training-hub-client").then((mod) => mod.TrainingHubClient),
  {
    loading: () => <MinimalLoader />,
  },
);

export const metadata = {
  title: "Training",
  description: "Create courses, upload content, and track learner completions.",
};

export default function TrainingPage() {
  return <TrainingHubClient />;
}
