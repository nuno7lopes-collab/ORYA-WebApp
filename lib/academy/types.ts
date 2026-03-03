export type AcademyClassDto = {
  id: number;
  organizationId: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
  coverImageUrl: string | null;
  bookingVertical: "CLASS";
  trainerIds: number[];
  resourceIds: number[];
  createdAt: string;
  updatedAt: string;
};

export type AcademySessionDto = {
  id: number;
  classId: number;
  seriesId: number | null;
  organizationId: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: string;
  trainer: { id: number; name: string } | null;
  court: { id: number; name: string | null } | null;
  enrolledCount: number;
  waitlistCount: number;
};

export type AcademyEnrollmentDto = {
  id: number;
  bookingId: number;
  classId: number;
  sessionId: number;
  userId: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
};

export type AcademyAttendanceDto = {
  id: number;
  sessionId: number;
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  note: string | null;
  markedAt: string;
  markedByUserId: string;
};

export type AcademyStudentProgressDto = {
  studentId: string;
  bookings: {
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  attendance: {
    present: number;
    absent: number;
    late: number;
    lastMarkedAt: string | null;
  };
  goals: Array<{
    id: number;
    title: string;
    status: string;
    targetDate: string | null;
  }>;
  latestNotes: Array<{
    id: number;
    createdAt: string;
    trainerUserId: string;
    sessionId: number | null;
    note: string;
  }>;
};

export type TrainerDashboardDto = {
  trainerUserId: string;
  nextSessions: AcademySessionDto[];
  pendingNotesCount: number;
  waitingMessagesCount: number;
};

export type AcademyChatThreadDto = {
  id: number;
  organizationId: number;
  classId: number | null;
  sessionId: number | null;
  threadRef: string;
  createdAt: string;
  updatedAt: string;
};
