"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import trLocale from "@fullcalendar/core/locales/tr";

type DayStatus = "AVAILABLE" | "LIMITED" | "FULL";

interface CalendarEvent {
  date: string;
  status: DayStatus;
  freeCapacity?: number;
  totalCapacity?: number;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function colorForStatus(status: DayStatus) {
  if (status === "AVAILABLE") {
    return "#22c55e";
  }
  if (status === "LIMITED") {
    return "#f59e0b";
  }
  return "#ef4444";
}

export function CapacityCalendar({
  events,
  startDate,
  endDate,
  onDateClick,
  onVisibleRangeChange
}: {
  events: CalendarEvent[];
  startDate?: string;
  endDate?: string;
  onDateClick?: (date: string) => void;
  onVisibleRangeChange?: (startDate: string, endDate: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        locale={trLocale}
        initialView="dayGridMonth"
        dateClick={(info: DateClickArg) => onDateClick?.(info.dateStr)}
        datesSet={(info) => {
          const lastVisibleDate = new Date(info.end);
          lastVisibleDate.setDate(lastVisibleDate.getDate() - 1);
          onVisibleRangeChange?.(dateKey(info.start), dateKey(lastVisibleDate));
        }}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: ""
        }}
        height="auto"
        dayCellClassNames={(arg) => {
          const date = dateKey(arg.date);
          return date === startDate || date === endDate ? ["date-range-edge"] :
            startDate && endDate && date > startDate && date < endDate ? ["date-range-middle"] : [];
        }}
        events={events.map((event) => ({
          title: event.status === "AVAILABLE" ? "Müsait" : event.status === "LIMITED" ? "Sınırlı" : "Dolu",
          date: event.date,
          color: colorForStatus(event.status)
        }))}
      />
    </div>
  );
}
