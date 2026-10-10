"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

type DayStatus = "AVAILABLE" | "LIMITED" | "FULL";

interface CalendarEvent {
  date: string;
  status: DayStatus;
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

export function CapacityCalendar({ events }: { events: CalendarEvent[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3">
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: ""
        }}
        height="auto"
        events={events.map((event) => ({
          title: event.status === "AVAILABLE" ? "Musait" : event.status === "LIMITED" ? "Sinirli Musait" : "Dolu",
          date: event.date,
          color: colorForStatus(event.status)
        }))}
      />
    </div>
  );
}
