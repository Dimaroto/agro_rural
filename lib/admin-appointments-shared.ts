export type AppointmentStatusValue =
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED";

export type AppointmentListItem = {
  id: string;
  startsAt: string;
  notes: string | null;
  status: AppointmentStatusValue;
  customer: {
    id: string;
    name: string;
    phone: string | null;
  };
};
