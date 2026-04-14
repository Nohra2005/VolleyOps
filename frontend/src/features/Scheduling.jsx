import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { apiFetch } from '../lib/api';
import './Scheduling.css';

const START_HOUR = 8;
const END_HOUR = 22;
const ROW_HEIGHT = 100;

const getMonday = (date) => {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const isDateInSameWeek = (dateA, dateB) =>
  isSameDay(getMonday(dateA), getMonday(dateB));

const toIsoDate = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(12, 0, 0, 0);
  return date.toISOString().slice(0, 10);
};

const formatHourLabel = (hour) => {
  if (hour === 12) return '12 PM';
  if (hour > 12) return `${hour - 12} PM`;
  return `${hour} AM`;
};

const getDefaultCreateDate = () => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return toIsoDate(date);
};

const eventOccursOnDay = (event, dayColumn) => {
  if (event.isRecurring) {
    const exceptions = event.exceptions || [];
    const recurrenceStart = event.recurrenceStartDate;
    const recurrenceEnd = event.recurrenceEndDate;

    if (event.dayOfWeek !== dayColumn.value) return false;
    if (recurrenceStart && dayColumn.iso < recurrenceStart) return false;
    if (recurrenceEnd && dayColumn.iso > recurrenceEnd) return false;
    if (exceptions.includes(dayColumn.iso)) return false;
    return true;
  }

  return event.specificDate === dayColumn.iso;
};

export default function Scheduling() {
  const navigate = useNavigate();
  const [selectedCourt, setSelectedCourt] = useState('Court 1');
  const [selectedDate, setSelectedDate] = useState(getMonday(new Date()));
  const [currentMiniMonth, setCurrentMiniMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [events, setEvents] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifyToast, setNotifyToast] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    teamId: '',
    day: 1,
    startHour: 9,
    endHour: 11,
    color: 'blue',
    isRecurring: true,
    court: 'Court 1',
    bookingDate: getDefaultCreateDate(),
    recurrenceStartDate: getDefaultCreateDate(),
    recurrenceEndDate: '',
    notifyTeam: false,
  });

  const [deleteModal, setDeleteModal] = useState({
    open: false,
    event: null,
    instanceDate: null,
  });

  const hours = useMemo(() => {
    const list = [];
    for (let i = START_HOUR; i <= END_HOUR; i += 1) {
      list.push({ label: formatHourLabel(i), value: i });
    }
    return list;
  }, []);

  const currentMonday = useMemo(() => getMonday(selectedDate), [selectedDate]);

  const currentSunday = useMemo(() => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + 6);
    return d;
  }, [currentMonday]);

  const weekRangeLabel = useMemo(() => {
    const sameMonth = currentMonday.getMonth() === currentSunday.getMonth();
    const sameYear = currentMonday.getFullYear() === currentSunday.getFullYear();

    if (sameMonth && sameYear) {
      return `${currentMonday.toLocaleString('default', {
        month: 'long',
      })} ${currentMonday.getDate()}–${currentSunday.getDate()}, ${currentMonday.getFullYear()}`;
    }

    if (sameYear) {
      return `${currentMonday.toLocaleString('default', {
        month: 'short',
      })} ${currentMonday.getDate()} – ${currentSunday.toLocaleString('default', {
        month: 'short',
      })} ${currentSunday.getDate()}, ${currentMonday.getFullYear()}`;
    }

    return `${currentMonday.toLocaleString('default', {
      month: 'short',
    })} ${currentMonday.getDate()}, ${currentMonday.getFullYear()} – ${currentSunday.toLocaleString('default', {
      month: 'short',
    })} ${currentSunday.getDate()}, ${currentSunday.getFullYear()}`;
  }, [currentMonday, currentSunday]);

  const mainCalendarDays = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(currentMonday);
        d.setDate(currentMonday.getDate() + i);
        d.setHours(12, 0, 0, 0);
        return {
          name: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
          date: d.getDate().toString(),
          value: i + 1,
          active: isSameDay(d, new Date()),
          fullDate: d,
          iso: toIsoDate(d),
        };
      }),
    [currentMonday]
  );

  const weekStartIso = useMemo(() => toIsoDate(currentMonday), [currentMonday]);

  const getDefaultFormData = (courtOverride) => {
    const fallbackCourt = courtOverride || selectedCourt || facilities[0]?.name || 'Court 1';
    const firstDay = mainCalendarDays[0] || {
      value: 1,
      iso: getDefaultCreateDate(),
    };

    return {
      title: '',
      teamId: teams[0] ? String(teams[0].id) : '',
      day: firstDay.value,
      startHour: 9,
      endHour: 11,
      color: 'blue',
      isRecurring: true,
      court: fallbackCourt,
      bookingDate: firstDay.iso,
      recurrenceStartDate: firstDay.iso,
      recurrenceEndDate: '',
      notifyTeam: false,
    };
  };

  const loadBookings = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/bookings?weekStart=${weekStartIso}`);
      setEvents(data || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = (prefillDay = null) => {
    const defaults = getDefaultFormData();
    if (prefillDay) {
      defaults.day = prefillDay.value;
      defaults.bookingDate = prefillDay.iso;
      defaults.recurrenceStartDate = prefillDay.iso;
    }
    setFormData(defaults);
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setSaving(false);
    setFormData(getDefaultFormData());
  };

  const handlePrevWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d);
    setCurrentMiniMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const handleNextWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d);
    setCurrentMiniMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const handleMiniDateClick = (date) => {
    setSelectedDate(date);
    setCurrentMiniMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMiniMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  useEffect(() => {
    const loadBootstrap = async () => {
      try {
        const data = await apiFetch('/api/bootstrap');
        const bootstrapFacilities = data.facilities || [];
        const bootstrapTeams = data.teams || [];

        setFacilities(bootstrapFacilities);
        setTeams(bootstrapTeams);

        if (bootstrapFacilities.length > 0) {
          const firstCourt = bootstrapFacilities[0].name;
          setSelectedCourt((prev) => prev || firstCourt);
          setFormData((prev) => ({
            ...prev,
            court: prev.court || firstCourt,
            teamId: prev.teamId || String(bootstrapTeams?.[0]?.id || ''),
          }));
        }
      } catch (err) {
        setError(err.message);
      }
    };

    loadBootstrap();
  }, []);

  useEffect(() => {
    loadBookings();
  }, [weekStartIso]);

  useEffect(() => {
    if (!notifyToast) return undefined;
    const timer = window.setTimeout(() => setNotifyToast(''), 2500);
    return () => window.clearTimeout(timer);
  }, [notifyToast]);

  useEffect(() => {
    if (!isModalOpen) return undefined;

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        closeCreateModal();
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [isModalOpen]);

  const handleEventClick = (event, dayColumn) => {
    setDeleteModal({ open: true, event, instanceDate: dayColumn.fullDate });
  };

  const confirmDelete = async (mode) => {
    const { event, instanceDate } = deleteModal;
    try {
      const query =
        mode === 'all'
          ? ''
          : `?mode=instance&instanceDate=${toIsoDate(instanceDate)}`;

      await apiFetch(`/api/bookings/${event.id}${query}`, { method: 'DELETE' });
      await loadBookings();
      setError('');
    } catch (err) {
      setError(err.message);
    }
    setDeleteModal({ open: false, event: null, instanceDate: null });
  };

  const closeDelete = () =>
    setDeleteModal({ open: false, event: null, instanceDate: null });

  const generateCalendarCells = () => {
    const year = currentMiniMonth.getFullYear();
    const month = currentMiniMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDay; i += 1) {
      cells.push({
        day: daysInPrevMonth - firstDay + i + 1,
        current: false,
        date: new Date(year, month - 1, daysInPrevMonth - firstDay + i + 1),
      });
    }

    for (let i = 1; i <= daysInMonth; i += 1) {
      cells.push({ day: i, current: true, date: new Date(year, month, i) });
    }

    while (cells.length < 42) {
      const nd = cells.length - firstDay - daysInMonth + 1;
      cells.push({
        day: nd,
        current: false,
        date: new Date(year, month + 1, nd),
      });
    }

    return cells;
  };

  const handleRecurringStartChange = (value) => {
    const nextDate = new Date(value);
    nextDate.setHours(12, 0, 0, 0);
    const weekday = nextDate.getDay();
    const normalizedWeekday = weekday === 0 ? 7 : weekday;

    setFormData((prev) => ({
      ...prev,
      recurrenceStartDate: value,
      day: normalizedWeekday,
      recurrenceEndDate:
        prev.recurrenceEndDate && prev.recurrenceEndDate < value ? value : prev.recurrenceEndDate,
    }));
  };

  const handleQuickRange = (weeks) => {
    if (!formData.recurrenceStartDate) return;
    const start = new Date(formData.recurrenceStartDate);
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() + weeks * 7);
    setFormData((prev) => ({
      ...prev,
      recurrenceEndDate: toIsoDate(start),
    }));
  };

  const handleNotifyTeamClick = () => {
    const teamName = teams.find((team) => String(team.id) === String(formData.teamId))?.name;
    setNotifyToast(
      teamName
        ? `Notify team placeholder ready for ${teamName}.`
        : 'Notify team placeholder button is ready for backend logic.'
    );
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();

    const selectedFacility = facilities.find(
      (item) => item.name === formData.court
    );

    if (!selectedFacility?.id) {
      setError('Please choose a valid court.');
      return;
    }

    const recurringStart = formData.recurrenceStartDate || formData.bookingDate;
    const recurringDate = new Date(recurringStart);
    recurringDate.setHours(12, 0, 0, 0);
    const recurringWeekday = recurringDate.getDay();
    const dayOfWeek = recurringWeekday === 0 ? 7 : recurringWeekday;

    try {
      setSaving(true);

      await apiFetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title.trim(),
          facility_id: selectedFacility.id,
          team_id: formData.teamId ? Number(formData.teamId) : null,
          day_of_week: formData.isRecurring ? dayOfWeek : null,
          specific_date: formData.isRecurring ? null : formData.bookingDate,
          recurrence_start_date: formData.isRecurring ? formData.recurrenceStartDate : null,
          recurrence_end_date:
            formData.isRecurring && formData.recurrenceEndDate
              ? formData.recurrenceEndDate
              : null,
          start_hour: Number(formData.startHour),
          end_hour: Number(formData.endHour),
          color: formData.color,
          is_recurring: formData.isRecurring,
          anchor_date: formData.isRecurring ? formData.recurrenceStartDate : formData.bookingDate,
          notify_team: formData.notifyTeam,
        }),
      });

      await loadBookings();
      closeCreateModal();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scheduling-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="VolleyOps" className="sidebar-logo" />
          <h1 className="sidebar-title">SCHEDULING</h1>
        </div>

        <button className="create-booking-btn" onClick={() => openCreateModal()}>
          <span>+</span> Create Booking
        </button>

        <div className="court-filters">
          {facilities.map(({ name: court }) => (
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
          <div className="mini-header">
            <h3>
              {currentMiniMonth.toLocaleString('default', {
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <div className="mini-arrows">
              <span
                onClick={() =>
                  setCurrentMiniMonth(
                    new Date(
                      currentMiniMonth.getFullYear(),
                      currentMiniMonth.getMonth() - 1,
                      1
                    )
                  )
                }
              >
                &#10094;
              </span>
              <span
                onClick={() =>
                  setCurrentMiniMonth(
                    new Date(
                      currentMiniMonth.getFullYear(),
                      currentMiniMonth.getMonth() + 1,
                      1
                    )
                  )
                }
              >
                &#10095;
              </span>
            </div>
          </div>

          <button className="mini-today-btn" onClick={handleJumpToToday}>
            Today
          </button>

          <div className="mini-days-header">
            <span>S</span>
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
            <span>S</span>
          </div>

          <div className="mini-grid">
            {generateCalendarCells().map((cell, idx) => {
              const isSelected = isSameDay(selectedDate, cell.date);
              const isInSelectedWeek = isDateInSameWeek(selectedDate, cell.date);
              const isToday = isSameDay(new Date(), cell.date);

              return (
                <span
                  key={idx}
                  className={[
                    cell.current ? '' : 'fade',
                    isInSelectedWeek ? 'selected-week-day' : '',
                    isSelected ? 'active-day' : '',
                    isToday ? 'today-day' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleMiniDateClick(cell.date)}
                  title={`Jump to week of ${getMonday(cell.date).toLocaleDateString()}`}
                >
                  {cell.day}
                </span>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="calendar-main">
        <header className="calendar-header">
          <div className="header-left">
            <div>
              <h2>{weekRangeLabel}</h2>
              <p className="week-subtitle">Selected week</p>
            </div>
            <div className="week-nav">
              <span onClick={handlePrevWeek}>&#10094;</span>
              <span onClick={handleNextWeek}>&#10095;</span>
            </div>
          </div>
          <button className="back-btn" onClick={() => navigate('/')}>
            Back <span>&rarr;</span>
          </button>
        </header>

        <div className="calendar-grid-header">
          <div className="time-spacer" />
          {mainCalendarDays.map((day, i) => (
            <div
              key={i}
              className={`day-column-header ${day.active ? 'active-col' : ''}`}
            >
              <span className="day-name">{day.name}</span>
              <span className="day-date">{day.date}</span>
            </div>
          ))}
        </div>

        <div className="calendar-body">
          {error && <p className="calendar-error">{error}</p>}
          {loading && <p className="calendar-loading">Loading bookings...</p>}

          <div className="time-labels">
            {hours.map((h, i) => (
              <div key={i} className="time-slot-label">
                <span>{h.label}</span>
              </div>
            ))}
          </div>

          <div className="days-grid">
            {mainCalendarDays.map((dayColumn, dayIndex) => (
              <div key={dayIndex} className="day-column">
                {hours.map((_, i) => (
                  <div key={i} className="grid-cell" />
                ))}

                {events
                  .filter(
                    (event) =>
                      event.court === selectedCourt && eventOccursOnDay(event, dayColumn)
                  )
                  .map((event) => (
                    <div
                      key={`${event.id}-${dayColumn.iso}`}
                      className={`event-card ${event.color}`}
                      title="Click to delete"
                      style={{
                        top: `${(event.startHour - START_HOUR) * ROW_HEIGHT}px`,
                        height: `${(event.endHour - event.startHour) * ROW_HEIGHT}px`,
                      }}
                      onClick={() => handleEventClick(event, dayColumn)}
                    >
                      <span className="event-title">{event.title}</span>
                      <span className="delete-hint">
                        {event.isRecurring ? 'Recurring booking' : 'One-time booking'}
                      </span>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </main>

      {deleteModal.open && (
        <div className="modal-overlay" onClick={closeDelete}>
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-modal-icon">🗓️</div>
            <h2>Delete "{deleteModal.event?.title}"?</h2>

            {deleteModal.event?.isRecurring ? (
              <>
                <p className="delete-modal-desc">
                  This is a <strong>recurring event</strong>. Remove only this
                  occurrence, or delete the full recurring booking?
                </p>
                <div className="delete-modal-actions">
                  <button className="cancel-btn" onClick={closeDelete}>
                    Keep
                  </button>
                  <button
                    className="delete-instance-btn"
                    onClick={() => confirmDelete('this')}
                  >
                    This instance only
                  </button>
                  <button
                    className="delete-all-btn"
                    onClick={() => confirmDelete('all')}
                  >
                    Full series
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="delete-modal-desc">
                  Are you sure you want to delete this event? This cannot be
                  undone.
                </p>
                <div className="delete-modal-actions">
                  <button className="cancel-btn" onClick={closeDelete}>
                    Cancel
                  </button>
                  <button
                    className="delete-all-btn"
                    onClick={() => confirmDelete('this')}
                  >
                    Delete event
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div
            className="modal-content scheduling-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-booking-title"
          >
            <div className="modal-header">
              <h2 id="create-booking-title">Create New Booking</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeCreateModal}
                aria-label="Close booking dialog"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateBooking}>
              <div className="form-group">
                <label>Event Name</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g., U16 Practice"
                />
              </div>

              <div className="form-group">
                <label>Team</label>
                <select
                  value={formData.teamId}
                  onChange={(e) =>
                    setFormData({ ...formData, teamId: e.target.value })
                  }
                >
                  <option value="">No team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Court</label>
                <select
                  value={formData.court}
                  onChange={(e) =>
                    setFormData({ ...formData, court: e.target.value })
                  }
                >
                  {facilities.map((facility) => (
                    <option key={facility.id} value={facility.name}>
                      {facility.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={formData.isRecurring}
                  onChange={(e) =>
                    setFormData({ ...formData, isRecurring: e.target.checked })
                  }
                />
                <label htmlFor="recurring">Repeat weekly</label>
              </div>

              {formData.isRecurring ? (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Start Date</label>
                      <input
                        type="date"
                        required
                        value={formData.recurrenceStartDate}
                        onChange={(e) => handleRecurringStartChange(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>End Date</label>
                      <input
                        type="date"
                        min={formData.recurrenceStartDate}
                        value={formData.recurrenceEndDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            recurrenceEndDate: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="quick-range-row">
                    <button type="button" onClick={() => handleQuickRange(4)}>
                      +4 weeks
                    </button>
                    <button type="button" onClick={() => handleQuickRange(8)}>
                      +8 weeks
                    </button>
                    <button type="button" onClick={() => handleQuickRange(12)}>
                      +12 weeks
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, recurrenceEndDate: '' })
                      }
                    >
                      No end
                    </button>
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    required
                    value={formData.bookingDate}
                    onChange={(e) =>
                      setFormData({ ...formData, bookingDate: e.target.value })
                    }
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Color</label>
                  <select
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                  >
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="purple">Purple</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Start</label>
                  <select
                    value={formData.startHour}
                    onChange={(e) =>
                      setFormData({ ...formData, startHour: e.target.value })
                    }
                  >
                    {hours.map((h) => (
                      <option key={h.value} value={h.value}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>End</label>
                  <select
                    value={formData.endHour}
                    onChange={(e) =>
                      setFormData({ ...formData, endHour: e.target.value })
                    }
                  >
                    {hours.map((h) => (
                      <option key={h.value} value={h.value}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="notify-row">
                <label className="notify-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.notifyTeam}
                    onChange={(e) =>
                      setFormData({ ...formData, notifyTeam: e.target.checked })
                    }
                  />
                  <span>Save "notify team" flag</span>
                </label>

                <button
                  type="button"
                  className="notify-team-btn"
                  onClick={handleNotifyTeamClick}
                >
                  Notify Team
                </button>
              </div>

              <div className="modal-actions sticky-modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={closeCreateModal}
                >
                  Cancel
                </button>
                <button type="submit" className="save-btn" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {notifyToast && <div className="notify-toast">{notifyToast}</div>}
    </div>
  );
}
