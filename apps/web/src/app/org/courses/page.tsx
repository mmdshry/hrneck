import dynamic from "next/dynamic";
import { MinimalLoader } from "@/components/ui/minimal-loader";

export const instant = false;

const CoursesClient = dynamic(
  () => import("./courses-client").then((mod) => mod.CoursesClient),
  {
    loading: () => <MinimalLoader />,
  },
);

export const metadata = {
  title: "Courses",
  description: "Create courses, lessons, and training media.",
};

export default function CoursesPage() {
  return <CoursesClient />;
}
