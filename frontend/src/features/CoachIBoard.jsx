import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { apiFetch } from '../lib/api';
import { useUser } from '../UserContextCore';
import './CoachIBoard.css';

const STORAGE_KEY = 'volleyops-coach-iboard-v3';

const uid = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const ROLE_LIBRARY = [
  { id: 'setter', label: 'Setter', short: 'S' },
  { id: 'opposite', label: 'Opposite', short: 'OPP' },
  { id: 'outside-1', label: 'Outside Hitter 1', short: 'OH1' },
  { id: 'outside-2', label: 'Outside Hitter 2', short: 'OH2' },
  { id: 'middle-1', label: 'Middle Blocker 1', short: 'MB1' },
  { id: 'middle-2', label: 'Middle Blocker 2', short: 'MB2' },
  { id: 'libero', label: 'Libero', short: 'L' },
];

const DRAWING_COLORS = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Purple', value: '#9333ea' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Black', value: '#0f172a' },
];

const SLOT_LAYOUT = [
  { id: '4', label: 'Position 4', x: 22, y: 23 },
  { id: '3', label: 'Position 3', x: 50, y: 23 },
  { id: '2', label: 'Position 2', x: 78, y: 23 },
  { id: '5', label: 'Position 5', x: 22, y: 72 },
  { id: '6', label: 'Position 6', x: 50, y: 72 },
  { id: '1', label: 'Position 1', x: 78, y: 72 },
];

const DEFAULT_LINEUP = {
  1: 'setter',
  2: 'outside-2',
  3: 'middle-2',
  4: 'outside-1',
  5: 'libero',
  6: 'opposite',
};

const ROTATION_ORDER = ['1', '6', '5', '4', '3', '2'];

const PRESET_ANIMATIONS = [
  {
    id: 'base-serve-receive',
    name: 'Base Serve Receive',
    description: 'Balanced serve-receive shape with setter transitioning from right back.',
    tags: ['receive', 'base', 'transition'],
    speed: 1,
    lineup: { ...DEFAULT_LINEUP },
    frames: [
      {
        name: 'Starting Shape',
        lineup: { ...DEFAULT_LINEUP },
        drawings: [
          { id: uid(), type: 'arrow', startX: 78, startY: 72, endX: 64, endY: 48, color: '#2563eb' },
          { id: uid(), type: 'arrow', startX: 22, startY: 72, endX: 35, endY: 60, color: '#16a34a' },
          { id: uid(), type: 'arrow', startX: 50, startY: 72, endX: 50, endY: 58, color: '#16a34a' },
        ],
      },
      {
        name: 'Pass Target',
        lineup: { ...DEFAULT_LINEUP },
        drawings: [
          { id: uid(), type: 'arrow', startX: 22, startY: 72, endX: 50, endY: 50, color: '#16a34a' },
          { id: uid(), type: 'arrow', startX: 50, startY: 72, endX: 50, endY: 50, color: '#16a34a' },
          { id: uid(), type: 'arrow', startX: 78, startY: 72, endX: 50, endY: 50, color: '#16a34a' },
        ],
      },
      {
        name: 'Attack Options',
        lineup: { ...DEFAULT_LINEUP },
        drawings: [
          { id: uid(), type: 'arrow', startX: 64, startY: 48, endX: 22, endY: 23, color: '#2563eb' },
          { id: uid(), type: 'arrow', startX: 64, startY: 48, endX: 50, endY: 23, color: '#2563eb' },
          { id: uid(), type: 'arrow', startX: 64, startY: 48, endX: 78, endY: 23, color: '#2563eb' },
        ],
      },
    ],
  },
  {
    id: 'quick-middle-option',
    name: 'Quick Middle Option',
    description: 'Setter pushes a fast tempo middle option with outside backup coverage.',
    tags: ['middle', 'quick', 'offense'],
    speed: 1.25,
    lineup: {
      1: 'setter',
      2: 'opposite',
      3: 'middle-1',
      4: 'outside-1',
      5: 'libero',
      6: 'outside-2',
    },
    frames: [
      {
        name: 'Receive Shape',
        lineup: {
          1: 'setter',
          2: 'opposite',
          3: 'middle-1',
          4: 'outside-1',
          5: 'libero',
          6: 'outside-2',
        },
        drawings: [
          { id: uid(), type: 'arrow', startX: 78, startY: 72, endX: 58, endY: 46, color: '#2563eb' },
        ],
      },
      {
        name: 'Middle Approach',
        lineup: {
          1: 'setter',
          2: 'opposite',
          3: 'middle-1',
          4: 'outside-1',
          5: 'libero',
          6: 'outside-2',
        },
        drawings: [
          { id: uid(), type: 'arrow', startX: 50, startY: 23, endX: 50, endY: 12, color: '#ea580c' },
          { id: uid(), type: 'arrow', startX: 58, startY: 46, endX: 50, endY: 14, color: '#2563eb' },
          { id: uid(), type: 'arrow', startX: 22, startY: 23, endX: 30, endY: 18, color: '#16a34a' },
        ],
      },
      {
        name: 'Coverage',
        lineup: {
          1: 'setter',
          2: 'opposite',
          3: 'middle-1',
          4: 'outside-1',
          5: 'libero',
          6: 'outside-2',
        },
        drawings: [
          { id: uid(), type: 'arrow', startX: 22, startY: 72, endX: 38, endY: 50, color: '#16a34a' },
          { id: uid(), type: 'arrow', startX: 50, startY: 72, endX: 50, endY: 52, color: '#16a34a' },
          { id: uid(), type: 'arrow', startX: 78, startY: 23, endX: 65, endY: 35, color: '#16a34a' },
        ],
      },
    ],
  },
  {
    id: 'pipe-attack',
    name: 'Back Row Pipe Attack',
    description: 'Outside hitter attacks through the pipe while pins hold blockers.',
    tags: ['pipe', 'tempo', 'attack'],
    speed: 1.15,
    lineup: {
      1: 'setter',
      2: 'opposite',
      3: 'middle-1',
      4: 'outside-1',
      5: 'libero',
      6: 'outside-2',
    },
    frames: [
      {
        name: 'Base',
        lineup: {
          1: 'setter',
          2: 'opposite',
          3: 'middle-1',
          4: 'outside-1',
          5: 'libero',
          6: 'outside-2',
        },
        drawings: [
          { id: uid(), type: 'arrow', startX: 78, startY: 72, endX: 60, endY: 48, color: '#2563eb' },
        ],
      },
      {
        name: 'Pipe Approach',
        lineup: {
          1: 'setter',
          2: 'opposite',
          3: 'middle-1',
          4: 'outside-1',
          5: 'libero',
          6: 'outside-2',
        },
        drawings: [
          { id: uid(), type: 'arrow', startX: 50, startY: 72, endX: 50, endY: 36, color: '#9333ea' },
          { id: uid(), type: 'arrow', startX: 60, startY: 48, endX: 50, endY: 36, color: '#2563eb' },
          { id: uid(), type: 'arrow', startX: 22, startY: 23, endX: 18, endY: 16, color: '#ea580c' },
          { id: uid(), type: 'arrow', startX: 78, startY: 23, endX: 82, endY: 16, color: '#ea580c' },
        ],
      },
      {
        name: 'Defensive Reset',
        lineup: {
          1: 'setter',
          2: 'opposite',
          3: 'middle-1',
          4: 'outside-1',
          5: 'libero',
          6: 'outside-2',
        },
        drawings: [
          { id: uid(), type: 'arrow', startX: 50, startY: 36, endX: 50, endY: 65, color: '#16a34a' },
          { id: uid(), type: 'arrow', startX: 22, startY: 72, endX: 30, endY: 60, color: '#16a34a' },
          { id: uid(), type: 'arrow', startX: 78, startY: 72, endX: 70, endY: 60, color: '#16a34a' },
        ],
      },
    ],
  },
];

const makePlayFromPreset = (preset) => ({
  id: uid(),
  serverId: null,
  name: preset.name,
  presetId: preset.id,
  courtView: 'FULL',
  playbackSpeed: preset.speed || 1,
  isLocked: false,
  lineup: { ...preset.lineup },
  annotations: preset.frames?.[0]?.drawings?.map((d) => ({ ...d, id: uid() })) || [],
  highlights: [],
  frames: preset.frames.map((frame) => ({
    ...frame,
    id: uid(),
    lineup: { ...frame.lineup },
    drawings: frame.drawings.map((drawing) => ({ ...drawing, id: uid() })),
  })),
});

const DEFAULT_PLAYS = PRESET_ANIMATIONS.slice(0, 2).map(makePlayFromPreset);

const getRoleById = (roleId) => ROLE_LIBRARY.find((role) => role.id === roleId) || null;

const clonePlay = (play) => ({
  ...play,
  id: uid(),
  serverId: null,
  name: `${play.name} Copy`,
  lineup: { ...(play.lineup || DEFAULT_LINEUP) },
  annotations: (play.annotations || []).map((item) => ({ ...item, id: uid() })),
  highlights: [...(play.highlights || [])],
  frames: (play.frames || []).map((frame) => ({
    ...frame,
    id: uid(),
    lineup: { ...(frame.lineup || DEFAULT_LINEUP) },
    drawings: (frame.drawings || []).map((drawing) => ({ ...drawing, id: uid() })),
  })),
});

const renumberFrames = (frames = []) =>
  frames.map((frame, index) => ({
    ...frame,
    name: `Frame ${index + 1}`,
  }));

const normalizePlay = (play) => ({
  id: play.id || uid(),
  serverId: play.serverId || (Number.isInteger(play.id) ? play.id : null),
  name: play.name || 'Untitled Play',
  presetId: play.presetId || '',
  courtView: play.courtView || 'FULL',
  playbackSpeed: Number(play.playbackSpeed || 1),
  isLocked: Boolean(play.isLocked),
  lineup: play.lineup || play.lineup_json || { ...DEFAULT_LINEUP },
  annotations: play.annotations || play.drawings || [],
  highlights: play.highlights || [],
  frames: renumberFrames(play.frames || [
    {
      id: uid(),
      name: 'Frame 1',
      lineup: play.lineup || { ...DEFAULT_LINEUP },
      drawings: play.annotations || play.drawings || [],
    },
  ]),
});

const readStoredBoard = () => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return { plays: DEFAULT_PLAYS, selectedPlayId: DEFAULT_PLAYS[0].id };
    const parsed = JSON.parse(saved);

    if (parsed?.plays?.length) {
      return {
        plays: parsed.plays.map(normalizePlay),
        selectedPlayId: parsed.selectedPlayId || parsed.plays[0].id,
      };
    }
  } catch {
    // fall through
  }

  return { plays: DEFAULT_PLAYS, selectedPlayId: DEFAULT_PLAYS[0].id };
};

export default function CoachIBoard() {
  const navigate = useNavigate();
  const user = useUser();
  const courtRef = useRef(null);
  const playTimer = useRef(null);
  const fadeTimer = useRef(null);
  const [storedBoard] = useState(readStoredBoard);

  const [plays, setPlays] = useState(storedBoard.plays);
  const [selectedPlayId, setSelectedPlayId] = useState(storedBoard.selectedPlayId);
  const [selectedPresetId, setSelectedPresetId] = useState(PRESET_ANIMATIONS[0].id);
  const [tool, setTool] = useState('select');
  const [selectedColor, setSelectedColor] = useState(DRAWING_COLORS[0].value);
  const [draggingTokenId, setDraggingTokenId] = useState(null);
  const [drawingDraft, setDrawingDraft] = useState(null);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [apiStatus, setApiStatus] = useState('Local mode');
  const [error, setError] = useState('');
  const [visibleDrawings, setVisibleDrawings] = useState([]);
  const [isFadingDrawings, setIsFadingDrawings] = useState(false);

  const selectedPlay = useMemo(
    () => plays.find((play) => String(play.id) === String(selectedPlayId)) || plays[0],
    [plays, selectedPlayId]
  );

  const frames = selectedPlay?.frames?.length
    ? selectedPlay.frames
    : [{ id: uid(), name: 'Frame 1', lineup: selectedPlay?.lineup || DEFAULT_LINEUP, drawings: selectedPlay?.annotations || [] }];

  const activeFrame = frames[Math.min(selectedFrameIndex, frames.length - 1)] || frames[0];
  const selectedLineup = activeFrame?.lineup || selectedPlay?.lineup || DEFAULT_LINEUP;
  const selectedDrawings = activeFrame?.drawings || selectedPlay?.annotations || [];

  const occupiedRoleIds = useMemo(() => new Set(Object.values(selectedLineup)), [selectedLineup]);
  const benchRoles = ROLE_LIBRARY.filter((role) => !occupiedRoleIds.has(role.id));

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ plays, selectedPlayId }));
  }, [plays, selectedPlayId]);

  useEffect(() => {
    const loadServerPlays = async () => {
      if (!user?.token) return;

      try {
        const data = await apiFetch('/api/plays', { token: user.token });
        if (Array.isArray(data) && data.length > 0) {
          const serverPlays = data.map((play) => normalizePlay({
            ...play,
            id: `server-${play.id}`,
            serverId: play.id,
            frames: play.highlights?.frames || play.frames,
          }));
          setPlays(serverPlays);
          setSelectedPlayId(serverPlays[0].id);
          setApiStatus('Synced with backend');
        }
      } catch {
        setApiStatus('Local mode');
      }
    };

    loadServerPlays();
  }, [user?.token]);

  useEffect(() => {
    if (!isPlaying) return;

    playTimer.current = window.setTimeout(() => {
      setSelectedFrameIndex((index) => {
        const next = index + 1;
        if (next >= frames.length) {
          setIsPlaying(false);
          return index;
        }
        return next;
      });
    }, Math.max(350, 1200 / Number(selectedPlay?.playbackSpeed || 1)));

    return () => window.clearTimeout(playTimer.current);
  }, [isPlaying, selectedFrameIndex, frames.length, selectedPlay?.playbackSpeed]);

  useEffect(() => {
    setIsFadingDrawings(true);
    window.clearTimeout(fadeTimer.current);

    fadeTimer.current = window.setTimeout(() => {
      setVisibleDrawings(selectedDrawings);
      window.requestAnimationFrame(() => setIsFadingDrawings(false));
    }, 180);

    return () => window.clearTimeout(fadeTimer.current);
  }, [selectedDrawings]);

  const updateSelectedPlay = (updater) => {
    setPlays((currentPlays) =>
      currentPlays.map((play) => {
        if (String(play.id) !== String(selectedPlayId)) return play;
        return normalizePlay(updater(play));
      })
    );
  };

  const updateActiveFrame = (updater) => {
    updateSelectedPlay((play) => {
      const nextFrames = [...frames];
      nextFrames[selectedFrameIndex] = updater(activeFrame);
      return {
        ...play,
        lineup: nextFrames[selectedFrameIndex].lineup,
        annotations: nextFrames[selectedFrameIndex].drawings,
        frames: nextFrames,
      };
    });
  };

  const handleLoadPreset = () => {
    const preset = PRESET_ANIMATIONS.find((item) => item.id === selectedPresetId);
    if (!preset) return;

    const newPlay = makePlayFromPreset(preset);
    setPlays((current) => [...current, newPlay]);
    setSelectedPlayId(newPlay.id);
    setSelectedFrameIndex(0);
    setTool('select');
    setError('');
  };

  const handlePlayRename = (event) => {
    const nextName = event.target.value;
    updateSelectedPlay((play) => ({ ...play, name: nextName }));
  };

  const handleDuplicatePlay = () => {
    if (!selectedPlay) return;
    const duplicated = clonePlay(selectedPlay);
    setPlays((current) => [...current, duplicated]);
    setSelectedPlayId(duplicated.id);
    setSelectedFrameIndex(0);
  };

  const handleCreateBlankPlay = () => {
    const newPlay = normalizePlay({
      id: uid(),
      name: `New Play ${plays.length + 1}`,
      lineup: { ...DEFAULT_LINEUP },
      annotations: [],
      frames: [{ id: uid(), name: 'Frame 1', lineup: { ...DEFAULT_LINEUP }, drawings: [] }],
    });

    setPlays((current) => [...current, newPlay]);
    setSelectedPlayId(newPlay.id);
    setSelectedFrameIndex(0);
  };

  const handleDeletePlay = async () => {
    if (!selectedPlay || plays.length <= 1) {
      setError('At least one play must remain on the board.');
      return;
    }

    const confirmed = window.confirm(`Delete "${selectedPlay.name}"?`);
    if (!confirmed) return;

    if (selectedPlay.serverId && user?.token) {
      try {
        await apiFetch(`/api/plays/${selectedPlay.serverId}`, {
          method: 'DELETE',
          token: user.token,
        });
      } catch {
        setError('Could not delete from backend, removed locally only.');
      }
    }

    setPlays((current) => {
      const next = current.filter((play) => String(play.id) !== String(selectedPlay.id));
      setSelectedPlayId(next[0].id);
      return next;
    });
    setSelectedFrameIndex(0);
  };

  const handleResetLineup = () => {
    updateActiveFrame((frame) => ({ ...frame, lineup: { ...DEFAULT_LINEUP } }));
  };

  const handleRotateLineup = () => {
    updateActiveFrame((frame) => {
      const current = frame.lineup || DEFAULT_LINEUP;
      const next = {};
      ROTATION_ORDER.forEach((slot, index) => {
        const fromSlot = ROTATION_ORDER[(index + 1) % ROTATION_ORDER.length];
        next[slot] = current[fromSlot];
      });
      return { ...frame, lineup: next };
    });
  };

  const handleClearDrawings = () => {
    updateActiveFrame((frame) => ({ ...frame, drawings: [] }));
  };

  const handleAddFrame = () => {
    updateSelectedPlay((play) => {
      const baseFrame = activeFrame || frames[frames.length - 1];
      const nextFrame = {
        id: uid(),
        name: `Frame ${frames.length + 1}`,
        lineup: { ...(baseFrame?.lineup || DEFAULT_LINEUP) },
        drawings: [],
      };

      return {
        ...play,
        frames: renumberFrames([...frames, nextFrame]),
      };
    });
    setSelectedFrameIndex(frames.length);
  };

  const handleDuplicateFrame = () => {
    updateSelectedPlay((play) => {
      const duplicated = {
        ...activeFrame,
        id: uid(),
        name: `${activeFrame.name || `Frame ${selectedFrameIndex + 1}`} Copy`,
        lineup: { ...(activeFrame.lineup || DEFAULT_LINEUP) },
        drawings: (activeFrame.drawings || []).map((drawing) => ({ ...drawing, id: uid() })),
      };

      const nextFrames = [...frames];
      nextFrames.splice(selectedFrameIndex + 1, 0, duplicated);

      return { ...play, frames: renumberFrames(nextFrames) };
    });

    setSelectedFrameIndex((index) => index + 1);
  };

  const handleDeleteFrame = () => {
    if (frames.length <= 1) {
      setError('A play needs at least one animation frame.');
      return;
    }

    updateSelectedPlay((play) => {
      const nextFrames = renumberFrames(frames.filter((_, index) => index !== selectedFrameIndex));
      return {
        ...play,
        frames: nextFrames,
        lineup: nextFrames[0].lineup,
        annotations: nextFrames[0].drawings,
      };
    });

    setSelectedFrameIndex((index) => Math.max(0, index - 1));
  };

  const swapIntoSlot = (incomingRoleId, targetSlotId) => {
    updateActiveFrame((frame) => {
      const nextLineup = { ...(frame.lineup || DEFAULT_LINEUP) };
      const sourceSlotId = Object.entries(nextLineup).find(([, roleId]) => roleId === incomingRoleId)?.[0];

      if (sourceSlotId === targetSlotId) return frame;

      const targetRoleId = nextLineup[targetSlotId];
      nextLineup[targetSlotId] = incomingRoleId;

      if (sourceSlotId) nextLineup[sourceSlotId] = targetRoleId;

      return { ...frame, lineup: nextLineup };
    });
  };

  const handleRoleDragStart = (roleId) => {
    if (tool !== 'select') return;
    setDraggingTokenId(roleId);
  };

  const handleRoleDragEnd = () => setDraggingTokenId(null);

  const handleSlotDrop = (targetSlotId) => {
    if (!draggingTokenId) return;
    swapIntoSlot(draggingTokenId, targetSlotId);
    setDraggingTokenId(null);
  };

  const getRelativePoint = (event) => {
    const rect = courtRef.current?.getBoundingClientRect();
    if (!rect) return null;

    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleCourtPointerDown = (event) => {
    if (tool !== 'arrow') return;
    const point = getRelativePoint(event);
    if (!point) return;

    setDrawingDraft({
      type: 'arrow',
      startX: point.x,
      startY: point.y,
      endX: point.x,
      endY: point.y,
      color: selectedColor,
    });
  };

  const handleCourtPointerMove = (event) => {
    if (tool !== 'arrow' || !drawingDraft) return;
    const point = getRelativePoint(event);
    if (!point) return;

    setDrawingDraft((current) => current ? { ...current, endX: point.x, endY: point.y } : current);
  };

  const finishArrow = (event) => {
    if (tool !== 'arrow' || !drawingDraft) return;

    const point = getRelativePoint(event);
    if (!point) {
      setDrawingDraft(null);
      return;
    }

    const completed = {
      ...drawingDraft,
      id: uid(),
      endX: point.x,
      endY: point.y,
      color: selectedColor,
    };

    const distance = Math.abs(completed.endX - completed.startX) + Math.abs(completed.endY - completed.startY);
    if (distance < 2) {
      setDrawingDraft(null);
      return;
    }

    updateActiveFrame((frame) => ({
      ...frame,
      drawings: [...(frame.drawings || []), completed],
    }));

    setDrawingDraft(null);
  };

  const saveToBackend = async () => {
    if (!user?.token) {
      setError('You must be logged in to save plays to the backend.');
      return;
    }

    try {
      setError('');
      setApiStatus('Saving...');

      const body = JSON.stringify({
        name: selectedPlay.name,
        ownerId: user.id,
        isLocked: selectedPlay.isLocked,
        courtView: selectedPlay.courtView,
        playbackSpeed: selectedPlay.playbackSpeed,
        lineup: activeFrame.lineup,
        annotations: activeFrame.drawings,
        highlights: {
          frames,
          presetId: selectedPlay.presetId,
          tags: PRESET_ANIMATIONS.find((preset) => preset.id === selectedPlay.presetId)?.tags || [],
        },
      });

      let saved;
      if (selectedPlay.serverId) {
        saved = await apiFetch(`/api/plays/${selectedPlay.serverId}`, {
          method: 'PUT',
          token: user.token,
          body,
        });
      } else {
        saved = await apiFetch('/api/plays', {
          method: 'POST',
          token: user.token,
          body,
        });
      }

      updateSelectedPlay((play) => ({
        ...play,
        serverId: saved.id,
        id: `server-${saved.id}`,
      }));
      setSelectedPlayId(`server-${saved.id}`);
      setApiStatus('Saved to backend');
    } catch (err) {
      setApiStatus('Local mode');
      setError(err.message || 'Could not save this play.');
    }
  };

  const exportPlay = () => {
    const blob = new Blob([JSON.stringify(selectedPlay, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedPlay.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const selectedPreset = PRESET_ANIMATIONS.find((preset) => preset.id === selectedPresetId);
  const frameTransitionMs = Math.round(Math.max(280, Math.min(760, 720 / Number(selectedPlay?.playbackSpeed || 1))));

  return (
    <div className="iboard-page">
      <aside className="iboard-sidebar">
        <div className="iboard-brand">
          <img src={logo} alt="VolleyOps" className="iboard-logo" />
          <div>
            <p className="iboard-eyebrow">VolleyOps</p>
            <h1>Coach iBoard</h1>
            <span className="sync-pill">{apiStatus}</span>
          </div>
        </div>

        {error && <div className="iboard-alert">{error}</div>}

        <div className="iboard-section preset-section">
          <h2>Preset Animation Loader</h2>
          <select className="preset-select" value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)}>
            {PRESET_ANIMATIONS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
          <p className="helper-text">{selectedPreset?.description}</p>
          <div className="preset-tags">
            {selectedPreset?.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <button className="primary-btn" onClick={handleLoadPreset}>Load Preset as New Play</button>
        </div>

        <div className="iboard-section">
          <div className="section-header">
            <h2>Saved Plays</h2>
            <button className="ghost-btn" onClick={handleCreateBlankPlay}>+ New</button>
          </div>

          <div className="plays-list">
            {plays.map((play) => (
              <button
                key={play.id}
                className={`play-list-item ${String(play.id) === String(selectedPlayId) ? 'active' : ''}`}
                onClick={() => {
                  setSelectedPlayId(play.id);
                  setSelectedFrameIndex(0);
                  setIsPlaying(false);
                }}
              >
                <span className="play-list-title">{play.name}</span>
                <span className="play-list-meta">
                  {play.frames?.length || 1} frame{play.frames?.length === 1 ? '' : 's'} • {play.annotations?.length || 0} drawing layer
                </span>
              </button>
            ))}
          </div>

          <div className="action-stack">
            <button className="secondary-btn" onClick={handleDuplicatePlay}>Duplicate</button>
            <button className="secondary-btn danger" onClick={handleDeletePlay}>Delete</button>
            <button className="secondary-btn" onClick={exportPlay}>Export</button>
          </div>
        </div>

        <div className="iboard-section">
          <h2>Tools</h2>
          <div className="tool-toggle">
            <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>Select</button>
            <button className={tool === 'arrow' ? 'active' : ''} onClick={() => setTool('arrow')}>Arrow</button>
          </div>

          <div className="color-picker">
            {DRAWING_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`color-swatch ${selectedColor === color.value ? 'active' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => setSelectedColor(color.value)}
                title={color.name}
                aria-label={color.name}
              />
            ))}
          </div>

          <div className="action-stack">
            <button className="secondary-btn" onClick={handleResetLineup}>Reset Lineup</button>
            <button className="secondary-btn" onClick={handleRotateLineup}>Rotate</button>
            <button className="secondary-btn" onClick={handleClearDrawings}>Clear Drawings</button>
          </div>
        </div>

        <div className="iboard-section">
          <h2>Bench / Role Tokens</h2>
          <p className="helper-text">Drag role tokens onto court slots. Use Rotate to simulate real volleyball rotation.</p>

          <div className="bench-role-list">
            {ROLE_LIBRARY.map((role) => {
              const isOnCourt = occupiedRoleIds.has(role.id);
              return (
                <div
                  key={role.id}
                  className={`role-token ${isOnCourt ? 'on-court' : 'bench'}`}
                  draggable={tool === 'select'}
                  onDragStart={() => handleRoleDragStart(role.id)}
                  onDragEnd={handleRoleDragEnd}
                  title={role.label}
                >
                  <span className="role-short">{role.short}</span>
                  <span className="role-label">{role.label}</span>
                </div>
              );
            })}
          </div>

          <div className="bench-summary">
            <strong>Bench roles:</strong>{' '}
            {benchRoles.length > 0 ? benchRoles.map((role) => role.short).join(', ') : 'None'}
          </div>
        </div>
      </aside>

      <main className="iboard-main">
        <header className="iboard-topbar">
          <div>
            <p className="iboard-eyebrow">Interactive animation whiteboard</p>
            <input className="play-name-input" value={selectedPlay?.name || ''} onChange={handlePlayRename} />
          </div>

          <div className="topbar-actions">
            <button className="primary-btn compact" onClick={saveToBackend}>Save Play</button>
            <button className="back-btn" onClick={() => navigate('/')}>Back <span>&rarr;</span></button>
          </div>
        </header>

        <section className="iboard-summary-row">
          <div className="summary-card">
            <span className="summary-label">Current tool</span>
            <strong>{tool === 'arrow' ? 'Arrow drawing' : 'Select / Drag'}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Animation</span>
            <strong>Frame {selectedFrameIndex + 1} of {frames.length}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Playback speed</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.25"
              value={selectedPlay?.playbackSpeed || 1}
              onChange={(e) => updateSelectedPlay((play) => ({ ...play, playbackSpeed: Number(e.target.value) }))}
            />
            <strong>{selectedPlay?.playbackSpeed || 1}x</strong>
          </div>
        </section>

        <section className="animation-timeline">
          <div className="timeline-header">
            <h2>Animation Timeline</h2>
            <div className="action-stack">
              <button className="secondary-btn" onClick={() => setSelectedFrameIndex(0)}>Restart</button>
              <button className="secondary-btn" onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? 'Pause' : 'Play'}</button>
              <button className="secondary-btn" onClick={handleAddFrame}>+ Frame</button>
              <button className="secondary-btn" onClick={handleDuplicateFrame}>Duplicate Frame</button>
              <button className="secondary-btn danger" onClick={handleDeleteFrame}>Delete Frame</button>
            </div>
          </div>

          <div className="frame-strip">
            {frames.map((frame, index) => (
              <button
                key={frame.id || index}
                className={`frame-chip ${index === selectedFrameIndex ? 'active' : ''}`}
                onClick={() => {
                  setSelectedFrameIndex(index);
                  setIsPlaying(false);
                }}
              >
                <span>{index + 1}</span>
                {`Frame ${index + 1}`}
              </button>
            ))}
          </div>
        </section>

        <section className="court-shell">
          <div
            ref={courtRef}
            className={`volleyball-court ${tool === 'arrow' ? 'arrow-mode' : ''}`}
            style={{ '--frame-transition': `${frameTransitionMs}ms` }}
            onMouseDown={handleCourtPointerDown}
            onMouseMove={handleCourtPointerMove}
            onMouseUp={finishArrow}
            onMouseLeave={() => setDrawingDraft(null)}
          >
            <svg className={`court-drawings ${isFadingDrawings ? 'is-fading' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                {DRAWING_COLORS.map((color) => (
                  <marker key={color.value} id={`arrowhead-${color.value.replace('#', '')}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={color.value} />
                  </marker>
                ))}
              </defs>

              {visibleDrawings.map((drawing, index) => (
                <line
                  key={`drawing-${index}`}
                  x1={drawing.startX}
                  y1={drawing.startY}
                  x2={drawing.endX}
                  y2={drawing.endY}
                  stroke={drawing.color}
                  strokeWidth="1.15"
                  strokeLinecap="round"
                  markerEnd={`url(#arrowhead-${drawing.color.replace('#', '')})`}
                />
              ))}

              {drawingDraft && (
                <line
                  x1={drawingDraft.startX}
                  y1={drawingDraft.startY}
                  x2={drawingDraft.endX}
                  y2={drawingDraft.endY}
                  stroke={selectedColor}
                  strokeWidth="1.1"
                  strokeDasharray="2 1.5"
                  strokeLinecap="round"
                />
              )}
            </svg>

            <div className="attack-line attack-line-top" />
            <div className="attack-line attack-line-bottom" />
            <div className="center-line" />

            {SLOT_LAYOUT.map((slot) => (
              <div
                key={slot.id}
                className="court-slot"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleSlotDrop(slot.id)}
              >
                <div className="slot-label">{slot.label}</div>
              </div>
            ))}

            {SLOT_LAYOUT.map((slot) => {
              const roleId = selectedLineup[slot.id];
              const role = getRoleById(roleId);

              return (
                <div
                  key={role?.id || `empty-${slot.id}`}
                  className={`court-player-token ${!role ? 'empty' : ''} ${draggingTokenId === roleId ? 'dragging' : ''}`}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  draggable={Boolean(role) && tool === 'select'}
                  onDragStart={() => role && handleRoleDragStart(role.id)}
                  onDragEnd={handleRoleDragEnd}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleSlotDrop(slot.id)}
                  title={role?.label || ''}
                >
                  <span className="role-short">{role?.short}</span>
                  <span className="role-label">{role?.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
