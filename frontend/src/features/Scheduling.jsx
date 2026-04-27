import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useUser } from '../UserContextCore';
import { apiFetch } from '../lib/api';
import { canEditScheduling } from '../permissions';
import './Scheduling.css';

const START_HOUR = 8;
const END_HOUR = 22;
const ROW_HEIGHT = 100;
const QUARTER_HOUR = 0.25;
const DEFAULT_DURATION_HOURS = 1;
const MIN_DURATION_HOURS = 0.25;
const BOOKING_COLORS = ['blue', 'green', 'purple'];

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

const roundToQuarterHour = (value) => Math.round(value / QUARTER_HOUR) * QUARTER_HOUR;

const clampDuration = (duration, startHour) => {
  const maxDuration = END_HOUR - startHour;
  return Math.max(MIN_DURATION_HOURS, Math.min(duration, maxDuration));
};

const clampStartHour = (startHour, durationHours) => {
  const maxStartHour = END_HOUR - durationHours;
  return Math.max(START_HOUR, Math.min(startHour, maxStartHour));
};

const formatHourLabel = (hourValue) => {
  const totalMinutes = Math.round(hourValue * 60);
  const hour24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minuteText = minutes === 0 ? '' : `:${minutes.toString().padStart(2, '0')}`;
  return `${hour12}${minuteText} ${suffix}`;
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
  const user = useUser();
  const canManageBookings = canEditScheduling(user.role);
  const [isEditMode, setIsEditMode] = useState(false);
  const [notifyAffectedPlayers, setNotifyAffectedPlayers] = useState(false);
  const [applyChangesToWeekOnly, setApplyChangesToWeekOnly] = useState(false);
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resizeState, setResizeState] = useState({
    active: false,
    edge: 'bottom',
    startY: 0,
    startHour: 9,
    startDuration: DEFAULT_DURATION_HOURS,
    previewStartHour: 9,
    previewDuration: DEFAULT_DURATION_HOURS,
  });
  const [dragState, setDragState] = useState({
    active: false,
    startX: 0,
    startY: 0,
    startHour: 9,
    startDayIndex: 0,
    previewStartHour: 9,
    previewDayIndex: 0,
    columnWidth: 0,
  });
  const [eventResizeState, setEventResizeState] = useState({
    active: false,
    bookingId: null,
    edge: 'bottom',
    startY: 0,
    startHour: 9,
    startDuration: DEFAULT_DURATION_HOURS,
    previewStartHour: 9,
    previewDuration: DEFAULT_DURATION_HOURS,
    dayIndex: 0,
    sourceDateIso: null,
  });
  const [eventDragState, setEventDragState] = useState({
    active: false,
    bookingId: null,
    startX: 0,
    startY: 0,
    startHour: 9,
    startDayIndex: 0,
    previewStartHour: 9,
    previewDayIndex: 0,
    columnWidth: 0,
    sourceDateIso: null,
  });
  const [updatingBookingId, setUpdatingBookingId] = useState(null);
  const [bookingInteractionPreview, setBookingInteractionPreview] = useState({});

  const [formData, setFormData] = useState({
    title: '',
    teamId: '',
    day: 1,
    startHour: 9,
    durationHours: DEFAULT_DURATION_HOURS,
    isRecurring: false,
    court: 'Court 1',
    bookingDate: getDefaultCreateDate(),
    recurrenceStartDate: getDefaultCreateDate(),
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

  const slotHours = useMemo(() => hours.filter((hour) => hour.value < END_HOUR), [hours]);
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
      })} ${currentMonday.getDate()}-${currentSunday.getDate()}, ${currentMonday.getFullYear()}`;
    }

    if (sameYear) {
      return `${currentMonday.toLocaleString('default', {
        month: 'short',
      })} ${currentMonday.getDate()} - ${currentSunday.toLocaleString('default', {
        month: 'short',
      })} ${currentSunday.getDate()}, ${currentMonday.getFullYear()}`;
    }

    return `${currentMonday.toLocaleString('default', {
      month: 'short',
    })} ${currentMonday.getDate()}, ${currentMonday.getFullYear()} - ${currentSunday.toLocaleString('default', {
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
      durationHours: DEFAULT_DURATION_HOURS,
      isRecurring: false,
      court: fallbackCourt,
      bookingDate: firstDay.iso,
      recurrenceStartDate: firstDay.iso,
    };
  };

  const loadBookings = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/bookings?weekStart=${weekStartIso}`, { token: user.token });
      setEvents(data || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = (prefill = null) => {
    const defaults = getDefaultFormData();
    if (prefill?.value) {
      defaults.day = prefill.value;
      defaults.bookingDate = prefill.iso;
      defaults.recurrenceStartDate = prefill.iso;
    }
    if (prefill?.court) {
      defaults.court = prefill.court;
    }
    if (typeof prefill?.startHour === 'number') {
      defaults.startHour = prefill.startHour;
      defaults.durationHours = clampDuration(
        prefill.durationHours ?? DEFAULT_DURATION_HOURS,
        prefill.startHour
      );
    }
    setFormData(defaults);
    setResizeState({
      active: false,
      edge: 'bottom',
      startY: 0,
      startHour: defaults.startHour,
      startDuration: defaults.durationHours,
      previewStartHour: defaults.startHour,
      previewDuration: defaults.durationHours,
    });
    setDragState({
      active: false,
      startX: 0,
      startY: 0,
      startHour: defaults.startHour,
      startDayIndex: 0,
      previewStartHour: defaults.startHour,
      previewDayIndex: 0,
      columnWidth: 0,
    });
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setSaving(false);
    setResizeState({
      active: false,
      edge: 'bottom',
      startY: 0,
      startHour: 9,
      startDuration: DEFAULT_DURATION_HOURS,
      previewStartHour: 9,
      previewDuration: DEFAULT_DURATION_HOURS,
    });
    setDragState({
      active: false,
      startX: 0,
      startY: 0,
      startHour: 9,
      startDayIndex: 0,
      previewStartHour: 9,
      previewDayIndex: 0,
      columnWidth: 0,
    });
    setFormData(getDefaultFormData());
  };

  const setBookingPreview = (bookingId, preview) => {
    setBookingInteractionPreview((prev) => ({
      ...prev,
      [bookingId]: preview,
    }));
  };

  const clearBookingPreview = (bookingId) => {
    setBookingInteractionPreview((prev) => {
      if (!(bookingId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[bookingId];
      return next;
    });
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
        const data = await apiFetch('/api/bootstrap', { token: user.token });
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
  }, [user.token]);

  useEffect(() => {
    loadBookings();
  }, [weekStartIso, user.token]);

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

  useEffect(() => {
    if (!resizeState.active) return undefined;

    const handleMouseMove = (event) => {
      const deltaHours = (event.clientY - resizeState.startY) / ROW_HEIGHT;
      if (resizeState.edge === 'top') {
        const rawStartHour = resizeState.startHour + deltaHours;
        const maxStartHour = resizeState.startHour + resizeState.startDuration - MIN_DURATION_HOURS;
        const previewStartHour = Math.max(START_HOUR, Math.min(rawStartHour, maxStartHour));
        const previewDuration = clampDuration(
          resizeState.startDuration - (previewStartHour - resizeState.startHour),
          previewStartHour
        );

        setResizeState((prev) => ({
          ...prev,
          previewStartHour,
          previewDuration,
        }));
        return;
      }

      const rawDuration = clampDuration(
        resizeState.startDuration + deltaHours,
        resizeState.startHour
      );
      setResizeState((prev) => ({
        ...prev,
        previewStartHour: resizeState.startHour,
        previewDuration: rawDuration,
      }));
    };

    const handleMouseUp = () => {
      const snappedStartHour = roundToQuarterHour(resizeState.previewStartHour);
      const snappedDuration = clampDuration(
        roundToQuarterHour(resizeState.previewDuration),
        snappedStartHour
      );
      setFormData((prev) => ({
        ...prev,
        startHour: snappedStartHour,
        durationHours: snappedDuration,
      }));
      setResizeState((prev) => ({
        ...prev,
        active: false,
        startHour: snappedStartHour,
        previewStartHour: snappedStartHour,
        startDuration: snappedDuration,
        previewDuration: snappedDuration,
      }));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [formData.startHour, resizeState]);

  useEffect(() => {
    if (!dragState.active) return undefined;

    const handleMouseMove = (event) => {
      const deltaHours = (event.clientY - dragState.startY) / ROW_HEIGHT;
      const deltaDays = dragState.columnWidth
        ? Math.round((event.clientX - dragState.startX) / dragState.columnWidth)
        : 0;
      const previewStartHour = clampStartHour(
        roundToQuarterHour(dragState.startHour + deltaHours),
        Number(formData.durationHours)
      );
      const previewDayIndex = Math.max(0, Math.min(6, dragState.startDayIndex + deltaDays));

      setDragState((prev) => ({
        ...prev,
        previewStartHour,
        previewDayIndex,
      }));
    };

    const handleMouseUp = () => {
      const snappedStartHour = clampStartHour(
        roundToQuarterHour(dragState.previewStartHour),
        Number(formData.durationHours)
      );
      const nextDay = mainCalendarDays[dragState.previewDayIndex] || mainCalendarDays[0];

      setFormData((prev) => ({
        ...prev,
        day: nextDay.value,
        startHour: snappedStartHour,
        bookingDate: nextDay.iso,
        recurrenceStartDate: nextDay.iso,
      }));
      setDragState((prev) => ({
        ...prev,
        active: false,
        startHour: snappedStartHour,
        startDayIndex: prev.previewDayIndex,
      }));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, formData.durationHours, mainCalendarDays]);

  useEffect(() => {
    if (!eventResizeState.active) return undefined;

    const handleMouseMove = (event) => {
      const deltaHours = (event.clientY - eventResizeState.startY) / ROW_HEIGHT;
      if (eventResizeState.edge === 'top') {
        const rawStartHour = eventResizeState.startHour + deltaHours;
        const maxStartHour =
          eventResizeState.startHour + eventResizeState.startDuration - MIN_DURATION_HOURS;
        const previewStartHour = Math.max(START_HOUR, Math.min(rawStartHour, maxStartHour));
        const previewDuration = clampDuration(
          eventResizeState.startDuration - (previewStartHour - eventResizeState.startHour),
          previewStartHour
        );

        setEventResizeState((prev) => ({
          ...prev,
          previewStartHour,
          previewDuration,
        }));
        setBookingPreview(eventResizeState.bookingId, {
          dayIndex: eventResizeState.dayIndex,
          startHour: previewStartHour,
          duration: previewDuration,
        });
        return;
      }

      const rawDuration = clampDuration(
        eventResizeState.startDuration + deltaHours,
        eventResizeState.startHour
      );
      setEventResizeState((prev) => ({
        ...prev,
        previewStartHour: eventResizeState.startHour,
        previewDuration: rawDuration,
      }));
      setBookingPreview(eventResizeState.bookingId, {
        dayIndex: eventResizeState.dayIndex,
        startHour: eventResizeState.startHour,
        duration: rawDuration,
      });
    };

    const handleMouseUp = async () => {
      const booking = events.find((item) => item.id === eventResizeState.bookingId);
      if (!booking) {
        setEventResizeState((prev) => ({ ...prev, active: false, bookingId: null }));
        return;
      }

      const snappedStartHour = roundToQuarterHour(eventResizeState.previewStartHour);
      const snappedDuration = clampDuration(
        roundToQuarterHour(eventResizeState.previewDuration),
        snappedStartHour
      );
      const dayColumn = mainCalendarDays[eventResizeState.dayIndex] || mainCalendarDays[0];
      const bookingId = eventResizeState.bookingId;

      setBookingPreview(bookingId, {
        dayIndex: eventResizeState.dayIndex,
        startHour: snappedStartHour,
        duration: snappedDuration,
      });

      setEventResizeState((prev) => ({
        ...prev,
        active: false,
        bookingId: null,
      }));

      await persistBookingUpdate(booking, {
        startHour: snappedStartHour,
        endHour: snappedStartHour + snappedDuration,
        dayColumn,
        dayIndex: eventResizeState.dayIndex,
        instanceDate: eventResizeState.sourceDateIso,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [eventResizeState, events, mainCalendarDays]);

  useEffect(() => {
    if (!eventDragState.active) return undefined;

    const movingBooking = events.find((item) => item.id === eventDragState.bookingId);
    if (!movingBooking) return undefined;

    const currentDuration = Number(movingBooking.endHour) - Number(movingBooking.startHour);

    const handleMouseMove = (event) => {
      const deltaHours = (event.clientY - eventDragState.startY) / ROW_HEIGHT;
      const deltaDays = eventDragState.columnWidth
        ? Math.round((event.clientX - eventDragState.startX) / eventDragState.columnWidth)
        : 0;
      const previewStartHour = clampStartHour(
        roundToQuarterHour(eventDragState.startHour + deltaHours),
        currentDuration
      );
      const previewDayIndex = Math.max(0, Math.min(6, eventDragState.startDayIndex + deltaDays));

      setEventDragState((prev) => ({
        ...prev,
        previewStartHour,
        previewDayIndex,
      }));
      setBookingPreview(eventDragState.bookingId, {
        dayIndex: previewDayIndex,
        startHour: previewStartHour,
        duration: currentDuration,
      });
    };

    const handleMouseUp = async () => {
      const booking = events.find((item) => item.id === eventDragState.bookingId);
      if (!booking) {
        setEventDragState((prev) => ({ ...prev, active: false, bookingId: null }));
        return;
      }

      const snappedStartHour = clampStartHour(
        roundToQuarterHour(eventDragState.previewStartHour),
        currentDuration
      );
      const dayColumn = mainCalendarDays[eventDragState.previewDayIndex] || mainCalendarDays[0];
      const bookingId = eventDragState.bookingId;

      setBookingPreview(bookingId, {
        dayIndex: eventDragState.previewDayIndex,
        startHour: snappedStartHour,
        duration: currentDuration,
      });

      setEventDragState((prev) => ({
        ...prev,
        active: false,
        bookingId: null,
      }));

      await persistBookingUpdate(booking, {
        startHour: snappedStartHour,
        endHour: snappedStartHour + currentDuration,
        dayColumn,
        dayIndex: eventDragState.previewDayIndex,
        instanceDate: eventDragState.sourceDateIso,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [eventDragState, events, mainCalendarDays]);

  const confirmDelete = async (mode) => {
    const { event, instanceDate } = deleteModal;
    try {
      const query =
        mode === 'all'
          ? ''
          : `?mode=instance&instanceDate=${toIsoDate(instanceDate)}`;

      await apiFetch(`/api/bookings/${event.id}${query}`, { method: 'DELETE', token: user.token });
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
    }));
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
    const selectedTeam = teams.find((team) => String(team.id) === String(formData.teamId));
    const teamColor = selectedTeam
      ? BOOKING_COLORS[selectedTeam.id % BOOKING_COLORS.length]
      : BOOKING_COLORS[0];
    const snappedDuration = clampDuration(
      roundToQuarterHour(formData.durationHours),
      Number(formData.startHour)
    );
    const endHour = Number(formData.startHour) + snappedDuration;

    try {
      setSaving(true);

      await apiFetch('/api/bookings', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          title: formData.title.trim(),
          facility_id: selectedFacility.id,
          team_id: formData.teamId ? Number(formData.teamId) : null,
          day_of_week: formData.isRecurring ? dayOfWeek : null,
          specific_date: formData.isRecurring ? null : formData.bookingDate,
          recurrence_start_date: formData.isRecurring ? formData.recurrenceStartDate : null,
          recurrence_end_date: null,
          start_hour: Number(formData.startHour),
          end_hour: endHour,
          color: teamColor,
          is_recurring: formData.isRecurring,
          anchor_date: formData.isRecurring ? formData.recurrenceStartDate : formData.bookingDate,
          notify_team: false,
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

  const persistBookingUpdate = async (booking, overrides) => {
    const nextStartHour = Number(overrides.startHour ?? booking.startHour);
    const nextEndHour = Number(overrides.endHour ?? booking.endHour);
    const nextDay = overrides.dayColumn;
    const nextCourt = overrides.court || booking.court;
      const selectedFacility = facilities.find((item) => item.name === nextCourt);

    if (!selectedFacility?.id || !nextDay) {
      setError('Unable to update booking with the selected court or date.');
      return;
    }

    const payload = {
      title: booking.title,
      facility_id: selectedFacility.id,
      team_id: booking.teamId,
      day_of_week: booking.isRecurring ? nextDay.value : null,
      specific_date: booking.isRecurring ? null : nextDay.iso,
      recurrence_start_date: booking.isRecurring ? nextDay.iso : null,
      recurrence_end_date: booking.recurrenceEndDate,
      start_hour: nextStartHour,
      end_hour: nextEndHour,
      color: booking.color,
      is_recurring: booking.isRecurring,
      anchor_date: nextDay.iso,
      notify_team: notifyAffectedPlayers,
    };
    const updateMode = booking.isRecurring && applyChangesToWeekOnly ? 'instance' : 'all';
    const instanceDate = overrides.instanceDate;
    const query =
      updateMode === 'instance' && instanceDate
        ? `?mode=instance&instanceDate=${instanceDate}`
        : '';

    try {
      setUpdatingBookingId(booking.id);
      setBookingPreview(booking.id, {
        dayIndex: overrides.dayIndex ?? getEventDayIndex(booking),
        startHour: nextStartHour,
        duration: nextEndHour - nextStartHour,
      });
      setEvents((prev) =>
        prev.map((item) =>
          item.id === booking.id
            ? {
                ...item,
                court: nextCourt,
                facilityId: selectedFacility.id,
                dayOfWeek: booking.isRecurring ? nextDay.value : item.dayOfWeek,
                specificDate: booking.isRecurring ? null : nextDay.iso,
                recurrenceStartDate: booking.isRecurring ? nextDay.iso : item.recurrenceStartDate,
                startHour: nextStartHour,
                endHour: nextEndHour,
              }
            : item
        )
      );

      await apiFetch(`/api/bookings/${booking.id}${query}`, {
        method: 'PUT',
        token: user.token,
        body: JSON.stringify(payload),
      });

      await loadBookings();
      setError('');
    } catch (err) {
      setError(err.message);
      await loadBookings();
    } finally {
      clearBookingPreview(booking.id);
      setUpdatingBookingId(null);
    }
  };

  const handleSlotClick = (dayColumn, baseHour, event) => {
    if (!canManageBookings || !isEditMode) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const offset = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const quarterIndex = Math.min(3, Math.floor((offset / rect.height) * 4));
    const startHour = baseHour + quarterIndex * QUARTER_HOUR;

    openCreateModal({
      value: dayColumn.value,
      iso: dayColumn.iso,
      court: selectedCourt,
      startHour,
      durationHours: DEFAULT_DURATION_HOURS,
    });
  };

  const handleEventDeleteClick = (booking, dayColumn, event) => {
    event.preventDefault();
    event.stopPropagation();
    setDeleteModal({ open: true, event: booking, instanceDate: dayColumn.fullDate });
  };

  const draftSlotDate = formData.isRecurring
    ? formData.recurrenceStartDate
    : formData.bookingDate;

  const formDayIndex = Math.max(
    0,
    mainCalendarDays.findIndex((day) => day.iso === draftSlotDate)
  );

  const displayedStartHour = resizeState.active
    ? resizeState.previewStartHour
    : dragState.active
      ? dragState.previewStartHour
    : Number(formData.startHour);

  const displayedDuration = resizeState.active
    ? resizeState.previewDuration
    : Number(formData.durationHours);

  const displayedDayIndex = dragState.active ? dragState.previewDayIndex : formDayIndex;
  const displayedDay = mainCalendarDays[displayedDayIndex] || mainCalendarDays[0];
  const displayedDraftSlotDate = displayedDay?.iso || draftSlotDate;

  const selectedSlotLabel = useMemo(() => {
    if (!displayedDraftSlotDate) {
      return '';
    }

    const [year, month, day] = displayedDraftSlotDate.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);

    return `${formData.court} | ${date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })} | ${formatHourLabel(displayedStartHour)} - ${formatHourLabel(
      displayedStartHour + Number(displayedDuration)
    )}`;
  }, [displayedDraftSlotDate, displayedDuration, displayedStartHour, formData.court]);

  const handleDraftResizeStart = (edge, event) => {
    event.preventDefault();
    event.stopPropagation();
    setResizeState({
      active: true,
      edge,
      startY: event.clientY,
      startHour: Number(formData.startHour),
      startDuration: Number(formData.durationHours),
      previewStartHour: Number(formData.startHour),
      previewDuration: Number(formData.durationHours),
    });
  };

  const handleDraftDragStart = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const columnWidth = event.currentTarget.closest('.day-column')?.getBoundingClientRect().width || 0;

    setDragState({
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      startHour: Number(formData.startHour),
      startDayIndex: formDayIndex,
      previewStartHour: Number(formData.startHour),
      previewDayIndex: formDayIndex,
      columnWidth,
    });
  };

  const getEventDayIndex = (booking) => {
    const matchingIndex = mainCalendarDays.findIndex((day) =>
      booking.isRecurring ? day.value === booking.dayOfWeek : day.iso === booking.specificDate
    );
    return Math.max(0, matchingIndex);
  };

  const handleExistingResizeStart = (booking, dayIndex, sourceDateIso, edge, event) => {
    event.preventDefault();
    event.stopPropagation();
    setEventResizeState({
      active: true,
      bookingId: booking.id,
      edge,
      startY: event.clientY,
      startHour: Number(booking.startHour),
      startDuration: Number(booking.endHour) - Number(booking.startHour),
      previewStartHour: Number(booking.startHour),
      previewDuration: Number(booking.endHour) - Number(booking.startHour),
      dayIndex,
      sourceDateIso,
    });
  };

  const handleExistingDragStart = (booking, dayIndex, sourceDateIso, event) => {
    event.preventDefault();
    event.stopPropagation();
    const columnWidth = event.currentTarget.closest('.day-column')?.getBoundingClientRect().width || 0;

    setEventDragState({
      active: true,
      bookingId: booking.id,
      startX: event.clientX,
      startY: event.clientY,
      startHour: Number(booking.startHour),
      startDayIndex: dayIndex,
      previewStartHour: Number(booking.startHour),
      previewDayIndex: dayIndex,
      columnWidth,
      sourceDateIso,
    });
  };

  const getRenderedBookingLayout = (booking) => {
    const baseDayIndex = getEventDayIndex(booking);
    const baseDuration = Number(booking.endHour) - Number(booking.startHour);
    const preview = bookingInteractionPreview[booking.id];

    if (preview) {
      return preview;
    }

    if (eventResizeState.active && eventResizeState.bookingId === booking.id) {
      return {
        dayIndex: eventResizeState.dayIndex,
        startHour: eventResizeState.previewStartHour,
        duration: eventResizeState.previewDuration,
      };
    }

    if (eventDragState.active && eventDragState.bookingId === booking.id) {
      return {
        dayIndex: eventDragState.previewDayIndex,
        startHour: eventDragState.previewStartHour,
        duration: baseDuration,
      };
    }

    return {
      dayIndex: baseDayIndex,
      startHour: Number(booking.startHour),
      duration: baseDuration,
    };
  };

  const isBookingShownOnDay = (booking, dayColumn, dayIndex) => {
    if (
      (eventResizeState.active && eventResizeState.bookingId === booking.id) ||
      (eventDragState.active && eventDragState.bookingId === booking.id)
    ) {
      return getRenderedBookingLayout(booking).dayIndex === dayIndex;
    }

    return eventOccursOnDay(booking, dayColumn);
  };

  return (
    <div className="scheduling-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="VolleyOps" className="sidebar-logo" />
          <h1 className="sidebar-title">SCHEDULING</h1>
        </div>

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
          <div className="header-actions">
            {canManageBookings && (
              <>
                <button
                  type="button"
                  className={`edit-mode-btn ${isEditMode ? 'active' : ''}`}
                  onClick={() => setIsEditMode((prev) => !prev)}
                >
                  {isEditMode ? 'Editing On' : 'Edit'}
                </button>
                <label className={`edit-notify-toggle ${isEditMode ? 'visible' : ''}`}>
                  <input
                    type="checkbox"
                    checked={notifyAffectedPlayers}
                    onChange={(event) => setNotifyAffectedPlayers(event.target.checked)}
                  />
                  <span>Notify affected players</span>
                </label>
                <label className={`edit-notify-toggle ${isEditMode ? 'visible' : ''}`}>
                  <input
                    type="checkbox"
                    checked={applyChangesToWeekOnly}
                    onChange={(event) => setApplyChangesToWeekOnly(event.target.checked)}
                  />
                  <span>This week only</span>
                </label>
              </>
            )}
            <button className="back-btn" onClick={() => navigate('/')}>
              Back <span>&rarr;</span>
            </button>
          </div>
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
            {mainCalendarDays.map((dayColumn, dayIndex) => {
              const showDraft =
                canManageBookings &&
                isModalOpen &&
                selectedCourt === formData.court &&
                displayedDraftSlotDate === dayColumn.iso;

              return (
                <div key={dayIndex} className="day-column">
                  {slotHours.map((hour) => (
                    <button
                      key={hour.value}
                      type="button"
                      className={`grid-cell ${canManageBookings && isEditMode ? 'grid-cell-interactive' : ''}`}
                      onClick={(event) => handleSlotClick(dayColumn, hour.value, event)}
                      aria-label={
                        canManageBookings && isEditMode
                          ? `Create booking on ${dayColumn.name} at ${hour.label} in ${selectedCourt}`
                          : undefined
                      }
                    >
                      {canManageBookings && isEditMode && <span className="grid-cell-plus">+</span>}
                    </button>
                  ))}

                  {showDraft && (
                    <div
                      className="event-card draft-event-card"
                      style={{
                        top: `${(displayedStartHour - START_HOUR) * ROW_HEIGHT}px`,
                        height: `${Number(displayedDuration) * ROW_HEIGHT}px`,
                      }}
                    >
                      <button
                        type="button"
                        className="draft-close-btn"
                        onClick={closeCreateModal}
                        aria-label="Discard draft booking"
                      >
                        x
                      </button>
                      <button
                        type="button"
                        className="draft-resize-handle draft-resize-handle-top"
                        onMouseDown={(event) => handleDraftResizeStart('top', event)}
                        aria-label="Adjust booking start time"
                      />
                      <span className="event-title">
                        {formData.title.trim() || 'New booking'}
                      </span>
                      <button
                        type="button"
                        className="draft-drag-body"
                        onMouseDown={handleDraftDragStart}
                        aria-label="Move booking to another time slot"
                      />
                      <button
                        type="button"
                        className="draft-resize-handle draft-resize-handle-bottom"
                        onMouseDown={(event) => handleDraftResizeStart('bottom', event)}
                        aria-label="Adjust booking end time"
                      />
                    </div>
                  )}

                  {events
                    .filter(
                      (event) =>
                        event.court === selectedCourt &&
                        isBookingShownOnDay(event, dayColumn, dayIndex)
                    )
                    .map((event) => {
                      const layout = getRenderedBookingLayout(event);
                      const isUpdating = updatingBookingId === event.id;

                      return (
                        <div
                          key={`${event.id}-${dayColumn.iso}`}
                          className={`event-card ${event.color} ${canManageBookings && isEditMode ? 'editable-event-card' : ''} ${isUpdating ? 'event-card-updating' : ''}`}
                          title={event.title}
                          style={{
                            top: `${(layout.startHour - START_HOUR) * ROW_HEIGHT}px`,
                            height: `${layout.duration * ROW_HEIGHT}px`,
                          }}
                        >
                          {canManageBookings && isEditMode && (
                            <button
                              type="button"
                              className="event-resize-handle event-resize-handle-top"
                              onMouseDown={(mouseEvent) =>
                                handleExistingResizeStart(event, layout.dayIndex, dayColumn.iso, 'top', mouseEvent)
                              }
                              aria-label={`Adjust start time for ${event.title}`}
                            />
                          )}

                          <div
                            className={`event-interaction-body ${canManageBookings && isEditMode ? 'is-draggable' : ''}`}
                            onMouseDown={
                              canManageBookings && isEditMode
                                ? (mouseEvent) => handleExistingDragStart(event, layout.dayIndex, dayColumn.iso, mouseEvent)
                                : undefined
                            }
                          >
                            {canManageBookings && isEditMode && (
                              <button
                                type="button"
                                className="event-delete-btn"
                                onClick={(mouseEvent) => handleEventDeleteClick(event, dayColumn, mouseEvent)}
                                aria-label={`Delete ${event.title}`}
                              >
                                x
                              </button>
                            )}
                            <span className="event-title">{event.title}</span>
                          </div>

                          {canManageBookings && isEditMode && (
                            <button
                              type="button"
                              className="event-resize-handle event-resize-handle-bottom"
                              onMouseDown={(mouseEvent) =>
                                handleExistingResizeStart(event, layout.dayIndex, dayColumn.iso, 'bottom', mouseEvent)
                              }
                              aria-label={`Adjust end time for ${event.title}`}
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {canManageBookings && deleteModal.open && (
        <div className="modal-overlay" onClick={closeDelete}>
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-modal-icon">[ ]</div>
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

      {canManageBookings && isModalOpen && (
        <div className="booking-panel-shell">
          <div
            className="modal-content scheduling-modal booking-panel"
            role="dialog"
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
                x
              </button>
            </div>

            <form onSubmit={handleCreateBooking}>
              <div className="slot-summary-card">
                <span className="slot-summary-label">Selected slot</span>
                <strong>{selectedSlotLabel}</strong>
              </div>

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
    </div>
  );
}
