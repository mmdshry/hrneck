import {
  Bell,
  ClipboardList,
  GraduationCap,
  Megaphone,
  Ticket,
  type LucideIcon,
} from "lucide-react";

export function notificationTypeIcon(type: string): LucideIcon {
  switch (type) {
    case "training_assigned":
      return GraduationCap;
    case "checklist_assigned":
      return ClipboardList;
    case "ticket_assigned":
      return Ticket;
    case "announcement":
      return Megaphone;
    default:
      return Bell;
  }
}
