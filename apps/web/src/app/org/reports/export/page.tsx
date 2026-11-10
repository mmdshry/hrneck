import { ReportExportClient } from "./export-client";

export const instant = false;

export const metadata = {
  title: "Report export",
  description: "Generate monthly and quarterly PDF business reports.",
};

export default function ReportExportPage() {
  return <ReportExportClient />;
}
