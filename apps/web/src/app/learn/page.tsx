import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { LearnClient } from "./learn-client";

export const metadata = {
  title: "Learn",
  description: "Learner portal for security awareness courses and quizzes.",
};

export default function LearnPage() {
  return (
    <Suspense fallback={<PageSkeleton className="max-w-3xl" variant="detail" />}>
      <LearnClient />
    </Suspense>
  );
}
