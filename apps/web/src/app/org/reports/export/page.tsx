import { ReportExportClient } from "./export-client";

export const metadata = {
  title: "Report export",
  description: "Generate monthly and quarterly PDF business reports.",
};

export default function ReportExportPage() {
  return <ReportExportClient />;
}
