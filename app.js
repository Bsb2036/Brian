const storageKey = "linda-care-calendar-events";

const periodTitle = document.querySelector("#period-title");
const calendarView = document.querySelector("#calendar-view");
const announcement = document.querySelector("#calendar-announcement");
const eventDialog = document.querySelector("#event-dialog");
const eventForm = document.querySelector("#event-form");
const eventCaregiver = document.querySelector("#event-caregiver");
const eventTitle = document.querySelector("#event-title");
const eventDate = document.querySelector("#event-date");
const eventType = document.querySelector("#event-type");
const eventStart = document.querySelector("#event-start");
const eventEnd = document.querySelector("#event-end");
const eventRepeat = document.querySelector("#event-repeat");
const eventNotes = document.querySelector("#event-notes");
const formError = document.querySelector("#form-error");
const deleteButton = document.querySelector("#delete-event");
const dialogTitle = document.querySelector("#dialog-title");

const requiredElements = [
  periodTitle,
  calendarView,
  announcement,
  eventDialog,
  eventForm,
  eventCaregiver,
  eventTitle,
  eventDate,
  eventType,
  eventStart,
  eventEnd,
  eventRepeat,
  eventNotes,
  formError,
  deleteButton,
  dialogTitle,
];

if (requiredElements.some((element) => element === null)) {
  throw new Error("The care calendar page is missing required HTML elements.");
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});
const monthDayFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const typeLabels = {
  care: "Daily care",
  appointment: "Appointment",
  family: "Family time",
  wellness: "Wellness",
};

let currentDate = startOfDay(new Date());
let currentView = "week";
let editingEventId = null;
let events = loadEvents();

document.querySelector("#previous-period").addEventListener("click", () => {
  movePeriod(-1);
});
document.querySelector("#next-period").addEventListener("click", () => {
  movePeriod(1);
});
document.querySelector("#go-today").addEventListener("click", () => {
  currentDate = startOfDay(new Date());
  renderCalendar();
  announce("Showing today.");
});
document.querySelector("#add-event").addEventListener("click", openNewEvent);
document.querySelector("#close-dialog").addEventListener("click", closeDialog);
document.querySelector("#cancel-dialog").addEventListener("click", closeDialog);
deleteButton.addEventListener("click", deleteEvent);
document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    renderCalendar();
  });
});
eventForm.addEventListener("submit", saveEvent);
eventDialog.addEventListener("close", resetDialog);
eventDate.addEventListener("input", () => {
  formError.textContent = "";
});
eventStart.addEventListener("input", () => {
  formError.textContent = "";
});
eventEnd.addEventListener("input", () => {
  formError.textContent = "";
});

renderCalendar();

function loadEvents() {
  let savedEvents;

  try {
    const savedValue = localStorage.getItem(storageKey);
    if (savedValue === null) {
      return [];
    }

    savedEvents = JSON.parse(savedValue);
    if (
      !Array.isArray(savedEvents) ||
      savedEvents.some(
        (event) =>
          typeof event !== "object" ||
          event === null ||
          typeof event.id !== "string" ||
          typeof event.title !== "string" ||
          typeof event.date !== "string" ||
          typeof event.start !== "string" ||
          typeof event.end !== "string" ||
          typeof event.type !== "string" ||
          typeof event.caregiver !== "string" ||
          typeof event.notes !== "string",
      )
    ) {
      throw new Error("Saved calendar data has an unexpected format.");
    }
  } catch (error) {
    announce(
      `Saved calendar items could not be loaded: ${error.message}. You can still add items during this visit.`,
    );
    return [];
  }

  return savedEvents.map((savedEvent) => {
    const event = { ...savedEvent };
    delete event.checkedInAt;
    delete event.checkedOutAt;
    return event;
  });
}

function saveEventsToDevice() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(events));
    return true;
  } catch (error) {
    announce(
      `This time is visible now, but could not be saved on this device: ${error.message}`,
    );
    return false;
  }
}

function announce(message) {
  announcement.textContent = message;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const result = startOfDay(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function startOfWeek(date) {
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function toGoogleCalendarDate(dateKey, time) {
  const date = dateKey.replaceAll("-", "");
  const clock = `${time.replace(":", "")}00`;
  return `${date}T${clock}`;
}

function createGoogleCalendarLink(event) {
  const details = [
    typeLabels[event.type] ?? "Care activity",
    `Caregiver: ${event.caregiver}`,
    event.notes ? `Note: ${event.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const parameters = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toGoogleCalendarDate(event.date, event.start)}/${toGoogleCalendarDate(event.date, event.end)}`,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    details,
  });
  const link = document.createElement("a");
  link.className = "google-calendar-link";
  link.href = `https://calendar.google.com/calendar/render?${parameters.toString()}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Add to Google Calendar";
  link.setAttribute(
    "aria-label",
    `Add ${event.title} to Google Calendar`,
  );
  return link;
}

function sortedEventsFor(dateKey) {
  return events
    .filter((event) => event.date === dateKey)
    .sort((first, second) => first.start.localeCompare(second.start));
}

function movePeriod(direction) {
  if (currentView === "month") {
    currentDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + direction,
      1,
    );
  } else {
    currentDate = addDays(currentDate, direction * (currentView === "week" ? 7 : 1));
  }
  renderCalendar();
}

function renderCalendar() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    const isActive = button.dataset.view === currentView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  calendarView.replaceChildren();

  if (currentView === "day") {
    renderDay();
  } else if (currentView === "month") {
    renderMonth();
  } else {
    renderWeek();
  }
}

function renderDay() {
  periodTitle.textContent = fullDateFormatter.format(currentDate);
  const schedule = document.createElement("section");
  schedule.className = "day-schedule";
  schedule.setAttribute("aria-label", "Activities for this day");
  appendEventList(schedule, currentDate);
  calendarView.append(schedule);
}

function renderWeek() {
  const firstDay = startOfWeek(currentDate);
  const lastDay = addDays(firstDay, 6);
  periodTitle.textContent =
    firstDay.getFullYear() === lastDay.getFullYear() &&
    firstDay.getMonth() === lastDay.getMonth()
      ? `${new Intl.DateTimeFormat(undefined, { month: "long" }).format(firstDay)} ${firstDay.getDate()}–${lastDay.getDate()}, ${lastDay.getFullYear()}`
      : `${monthDayFormatter.format(firstDay)} – ${monthDayFormatter.format(lastDay)}`;

  const grid = document.createElement("div");
  grid.className = "calendar-grid week-grid";
  grid.setAttribute("role", "list");

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(firstDay, offset);
    const column = document.createElement("section");
    column.className = "week-day";
    column.setAttribute("role", "listitem");

    const heading = document.createElement("button");
    heading.className = "week-day-heading";
    heading.type = "button";
    heading.setAttribute("aria-label", `Show ${fullDateFormatter.format(date)}`);
    heading.textContent = dateFormatter.format(date);
    heading.addEventListener("click", () => showDay(date));
    column.append(heading);
    appendEventList(column, date);
    grid.append(column);
  }

  calendarView.append(grid);
}

function renderMonth() {
  periodTitle.textContent = monthFormatter.format(currentDate);
  const grid = document.createElement("div");
  grid.className = "calendar-grid month-grid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", monthFormatter.format(currentDate));

  const weekdayNames = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
  });
  const monday = startOfWeek(new Date(2024, 0, 1));

  for (let offset = 0; offset < 7; offset += 1) {
    const weekday = document.createElement("div");
    weekday.className = "month-weekday";
    weekday.setAttribute("role", "columnheader");
    weekday.textContent = weekdayNames.format(addDays(monday, offset));
    grid.append(weekday);
  }

  const firstOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1,
  );
  const firstVisibleDay = startOfWeek(firstOfMonth);
  const dayCount = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0,
  ).getDate();
  const cellCount = Math.ceil(
    (((firstOfMonth.getDay() + 6) % 7) + dayCount) / 7,
  ) * 7;

  for (let offset = 0; offset < cellCount; offset += 1) {
    const date = addDays(firstVisibleDay, offset);
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
    const dayEvents = sortedEventsFor(toDateKey(date));
    const cell = document.createElement("button");
    cell.className = "month-day";
    cell.type = "button";
    cell.setAttribute(
      "aria-label",
      `${fullDateFormatter.format(date)}${dayEvents.length ? `, ${dayEvents.length} scheduled ${dayEvents.length === 1 ? "item" : "items"}` : ""}`,
    );
    if (!isCurrentMonth) {
      cell.classList.add("outside-month");
    }
    if (toDateKey(date) === toDateKey(new Date())) {
      cell.classList.add("is-today");
    }
    cell.addEventListener("click", () => showDay(date));

    const dayNumber = document.createElement("span");
    dayNumber.className = "month-day-number";
    dayNumber.textContent = String(date.getDate());
    cell.append(dayNumber);

    dayEvents.slice(0, 2).forEach((event) => {
      const summary = document.createElement("span");
      summary.className = `month-event event-${event.type}`;
      summary.textContent = event.title;
      cell.append(summary);
    });

    if (dayEvents.length > 2) {
      const more = document.createElement("span");
      more.className = "month-more";
      more.textContent = `+${dayEvents.length - 2} more`;
      cell.append(more);
    }

    grid.append(cell);
  }

  calendarView.append(grid);
}

function appendEventList(container, date) {
  const dayEvents = sortedEventsFor(toDateKey(date));
  if (dayEvents.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-day";
    empty.textContent =
      currentView === "day"
        ? "No care times planned. Add a time when you’re ready."
        : "Nothing planned";
    container.append(empty);
    return;
  }

  const list = document.createElement("ul");
  list.className = "event-list";
  dayEvents.forEach((event) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `event-item event-${event.type}`;
    button.setAttribute(
      "aria-label",
      `Edit ${event.title}, ${formatTime(event.start)} to ${formatTime(event.end)}, ${event.caregiver}`,
    );
    button.addEventListener("click", () => openExistingEvent(event));

    const time = document.createElement("span");
    time.className = "event-time";
    time.textContent = `${formatTime(event.start)}–${formatTime(event.end)}`;

    const title = document.createElement("strong");
    title.className = "event-title";
    title.textContent = event.title;

    const caregiver = document.createElement("span");
    caregiver.className = "event-caregiver";
    caregiver.textContent = event.caregiver;

    button.append(time, title, caregiver);
    if (event.notes) {
      const notes = document.createElement("span");
      notes.className = "event-notes";
      notes.textContent = event.notes;
      button.append(notes);
    }

    item.append(button, createGoogleCalendarLink(event));
    list.append(item);
  });
  container.append(list);
}

function showDay(date) {
  currentDate = startOfDay(date);
  currentView = "day";
  renderCalendar();
  announce(`Showing ${fullDateFormatter.format(currentDate)}.`);
}

function openNewEvent() {
  editingEventId = null;
  eventForm.reset();
  eventDate.value = toDateKey(currentDate);
  eventStart.value = "09:00";
  eventEnd.value = "10:00";
  formError.textContent = "";
  deleteButton.hidden = true;
  dialogTitle.textContent = "Plan some time";
  eventDialog.showModal();
  eventTitle.focus();
}

function openExistingEvent(event) {
  editingEventId = event.id;
  eventCaregiver.value = event.caregiver;
  eventTitle.value = event.title;
  eventDate.value = event.date;
  eventType.value = event.type;
  eventStart.value = event.start;
  eventEnd.value = event.end;
  eventRepeat.value = "0";
  eventRepeat.disabled = true;
  document.querySelector("#repeat-help").textContent =
    "Repeats are set when adding a new care time.";
  eventNotes.value = event.notes;
  formError.textContent = "";
  deleteButton.hidden = false;
  dialogTitle.textContent = "Edit this time";
  eventDialog.showModal();
  eventTitle.focus();
}

function closeDialog() {
  eventDialog.close();
}

function resetDialog() {
  editingEventId = null;
  eventRepeat.disabled = false;
  document.querySelector("#repeat-help").textContent =
    "Adds the same caregiver, activity, and time on this weekday. The selected date is included, plus the extra weeks you choose.";
  formError.textContent = "";
  eventForm.reset();
}

function saveEvent(event) {
  event.preventDefault();
  formError.textContent = "";

  const isEditing = editingEventId !== null;
  if (!eventForm.reportValidity()) {
    return;
  }
  const repeatCount = Number(eventRepeat.value);
  if (![0, 1, 2, 4].includes(repeatCount)) {
    formError.textContent = "Choose a valid repeat schedule.";
    eventRepeat.focus();
    return;
  }
  if (eventEnd.value <= eventStart.value) {
    formError.textContent = "The end time must be later than the start time.";
    eventEnd.focus();
    return;
  }

  const calendarEvent = {
    id: editingEventId ?? createEventId(),
    caregiver: eventCaregiver.value,
    title: eventTitle.value.trim(),
    date: eventDate.value,
    type: eventType.value,
    start: eventStart.value,
    end: eventEnd.value,
    notes: eventNotes.value.trim(),
  };

  if (!calendarEvent.title) {
    formError.textContent = "Enter a name for this care activity.";
    eventTitle.focus();
    return;
  }

  if (editingEventId === null) {
    events.push(calendarEvent);
    for (let week = 1; week <= repeatCount; week += 1) {
      events.push({
        ...calendarEvent,
        id: createEventId(),
        date: toDateKey(addDays(fromDateKey(calendarEvent.date), week * 7)),
      });
    }
  } else {
    events = events.map((savedEvent) =>
      savedEvent.id === editingEventId
        ? calendarEvent
        : savedEvent,
    );
  }

  currentDate = fromDateKey(calendarEvent.date);
  const saved = saveEventsToDevice();
  eventDialog.close();
  renderCalendar();
  if (saved) {
    announce(
      isEditing
        ? "Care time updated."
        : repeatCount
          ? `Care time added with ${repeatCount} weekly ${repeatCount === 1 ? "copy" : "copies"}.`
          : "Care time added.",
    );
  }
}

function deleteEvent() {
  if (editingEventId === null) {
    return;
  }
  if (!window.confirm("Delete this scheduled care time?")) {
    return;
  }

  events = events.filter((event) => event.id !== editingEventId);
  const saved = saveEventsToDevice();
  eventDialog.close();
  renderCalendar();
  if (saved) {
    announce("Care time deleted.");
  }
}

function createEventId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
