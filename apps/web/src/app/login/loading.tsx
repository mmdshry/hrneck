import { MinimalLoader } from "@/components/ui/minimal-loader";

export default function LoginLoading() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <MinimalLoader />
    </div>
  );
}
