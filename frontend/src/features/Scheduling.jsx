import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Scheduling.css';

const getMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

export default function Scheduling() {
  const navigate = useNavigate();
  const [selectedCourt, setSelectedCourt] = useState('Court 1');
  const [selectedDate, setSelectedDate] = useState(getMonday(new Date()));
  const [currentMiniMonth, setCurrentMiniMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [events, setEvents] = useState([
    { id: 1, title: 'U16 Team', court: 'Court 1', dayOfWeek: 1, specificDate: null, startHour: 9, endHour: 11, color: 'blue', isRecurring: true },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '', day: 1, startHour: 9, endHour: 11, color: 'blue', isRecurring: true, court: 'Court 1'
  });

  const START_HOUR = 8;
  const END_HOUR = 22;
  const ROW_HEIGHT = 100;

  const hours = [];
  for (let i = START_HOUR; i <= END_HOUR; i++) {
    const label = i === 12 ? '12 PM' : i > 12 ? `${i - 12} PM` : `${i} AM`;
    hours.push({ label, value: i });
  }

  const currentMonday = getMonday(selectedDate);
  const mainCalendarDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + i);
    return {
      name: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      date: d.getDate().toString(),
      value: i + 1,
      active: d.toDateString() === new Date().toDateString(),
      fullDate: d,
    };
  });

  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 7);
    setSelectedDate(newDate);
    setCurrentMiniMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
  };

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 7);
    setSelectedDate(newDate);
    setCurrentMiniMonth(new Date(newDate.getFullYear(), newDate.getMonth(), 1));
  };

  const handleMiniDateClick = (date) => {
    setSelectedDate(date);
    setCurrentMiniMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  // Delete an event by id
  const handleDeleteEvent = (id) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const generateCalendarCells = () => {
    const year = currentMiniMonth.getFullYear();
    const month = currentMiniMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: daysInPrevMonth - firstDay + i + 1, current: false, date: new Date(year, month - 1, daysInPrevMonth - firstDay + i + 1) });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ day: i, current: true, date: new Date(year, month, i) });
    }
    while (cells.length < 42) {
      const nextDay = cells.length - firstDay - daysInMonth + 1;
      cells.push({ day: nextDay, current: false, date: new Date(year, month + 1, nextDay) });
    }
    return cells;
  };

  const handleCreateBooking = (e) => {
    e.preventDefault();
    const newId = events.length > 0 ? Math.max(...events.map((ev) => ev.id)) + 1 : 1;
    const newEvent = {
      id: newId,
      title: formData.title,
      court: formData.court,
      dayOfWeek: Number(formData.day),
      specificDate: formData.isRecurring
        ? null
        : mainCalendarDays.find((d) => d.value === Number(formData.day)).fullDate.toDateString(),
      startHour: Number(formData.startHour),
      endHour: Number(formData.endHour),
      color: formData.color,
      isRecurring: formData.isRecurring,
    };
    setEvents([...events, newEvent]);
    setIsModalOpen(false);
  };

  return (
    <div className="scheduling-container">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className="sidebar">
        <h1 className="sidebar-title">SCHEDULING</h1>

        <button
          className="create-booking-btn"
          onClick={() => {
            setFormData((prev) => ({ ...prev, court: selectedCourt }));
            setIsModalOpen(true);
          }}
        >
          <span className="plus-icon">+</span> Create Booking
        </button>

        <div className="court-filters">
          {['Court 1', 'Court 2', 'Main Hall'].map((court) => (
            <button
              key={court}
              className={`court-btn ${selectedCourt === court ? 'active' : ''}`}
              onClick={() => setSelectedCourt(court)}
            >
              {court}
            </button>
          ))}
        </div>

        <div className="mini-calendar">
          {/* FIX: week nav arrows are siblings of h3, NOT nested inside it */}
          <div className="mini-header">
            <h3>{currentMiniMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
            <div className="mini-arrows">
              <span onClick={() => setCurrentMiniMonth(new Date(currentMiniMonth.getFullYear(), currentMiniMonth.getMonth() - 1, 1))}>&#10094;</span>
              <span onClick={() => setCurrentMiniMonth(new Date(currentMiniMonth.getFullYear(), currentMiniMonth.getMonth() + 1, 1))}>&#10095;</span>
            </div>
          </div>

          <div className="mini-days-header">
            <span>S</span><span>M</span><span>T</span>
            <span>W</span><span>T</span><span>F</span><span>S</span>
          </div>

          <div className="mini-grid">
            {generateCalendarCells().map((cell, idx) => {
              const isSelected = selectedDate.toDateString() === cell.date.toDateString();
              return (
                <span
                  key={idx}
                  className={`${cell.current ? '' : 'fade'} ${isSelected ? 'active-day' : ''}`}
                  onClick={() => handleMiniDateClick(cell.date)}
                >
                  {cell.day}
                </span>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Main calendar ────────────────────────────────────── */}
      <main className="calendar-main">
        {/*
          FIX: week-nav <div> moved out of <h2> — a block element
          inside a heading is invalid HTML and breaks layout.
        */}
        <header className="calendar-header">
          <div className="header-left">
            <h2>{currentMonday.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
            <div className="week-nav">
              <span onClick={handlePrevWeek}>&#10094;</span>
              <span onClick={handleNextWeek}>&#10095;</span>
            </div>
          </div>
          <button className="back-btn" onClick={() => navigate('/')}>
            Back <span>&rarr;</span>
          </button>
        </header>

        {/* Day-name header row */}
        <div className="calendar-grid-header">
          <div className="time-spacer" />
          {mainCalendarDays.map((day, index) => (
            <div
              key={index}
              className={`day-column-header ${day.active ? 'active-col' : ''}`}
            >
              <span className="day-name">{day.name}</span>
              <span className="day-date">{day.date}</span>
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="calendar-body">
          {/* Time labels — each span centred ON its grid line */}
          <div className="time-labels">
            {hours.map((h, i) => (
              <div key={i} className="time-slot-label">
                <span>{h.label}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="days-grid">
            {mainCalendarDays.map((dayColumn, dayIndex) => (
              <div key={dayIndex} className="day-column">
                {/* Background grid cells (the horizontal lines) */}
                {hours.map((_, i) => (
                  <div key={i} className="grid-cell" />
                ))}

                {/* Event cards — click to delete */}
                {events
                  .filter(
                    (e) =>
                      e.court === selectedCourt &&
                      (e.isRecurring
                        ? e.dayOfWeek === dayColumn.value
                        : e.specificDate === dayColumn.fullDate.toDateString())
                  )
                  .map((event) => (
                    <div
                      key={event.id}
                      className={`event-card ${event.color}`}
                      title="Click to delete"
                      style={{
                        top: `${(event.startHour - START_HOUR) * ROW_HEIGHT}px`,
                        height: `${(event.endHour - event.startHour) * ROW_HEIGHT}px`,
                      }}
                      onClick={() => handleDeleteEvent(event.id)}
                    >
                      <span className="event-title">{event.title}</span>
                      <span className="delete-hint">Click to delete</span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ── Create booking modal ─────────────────────────────── */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Create New Booking</h2>
            <form onSubmit={handleCreateBooking}>
              <div className="form-group">
                <label>Event Name</label>
                <input
                  type="text" required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., U16 Practice"
                />
              </div>

              <div className="form-group">
                <label>Court</label>
                <select value={formData.court} onChange={(e) => setFormData({ ...formData, court: e.target.value })}>
                  <option value="Court 1">Court 1</option>
                  <option value="Court 2">Court 2</option>
                  <option value="Main Hall">Main Hall</option>
                </select>
              </div>

              <div className="checkbox-group">
                <input
                  type="checkbox" id="recurring"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                />
                <label htmlFor="recurring">Repeat weekly</label>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Day</label>
                  <select value={formData.day} onChange={(e) => setFormData({ ...formData, day: e.target.value })}>
                    {mainCalendarDays.map((d) => (
                      <option key={d.value} value={d.value}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <select value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })}>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="purple">Purple</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start</label>
                  <select value={formData.startHour} onChange={(e) => setFormData({ ...formData, startHour: e.target.value })}>
                    {hours.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>End</label>
                  <select value={formData.endHour} onChange={(e) => setFormData({ ...formData, endHour: e.target.value })}>
                    {hours.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="save-btn">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}