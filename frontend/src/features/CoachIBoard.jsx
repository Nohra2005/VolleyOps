import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import './CoachIBoard.css';

const STORAGE_KEY = 'volleyops-coach-iboard';

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
  '1': 'setter',
  '2': 'outside-2',
  '3': 'middle-2',
  '4': 'outside-1',
  '5': 'libero',
  '6': 'opposite',
};

const DEFAULT_PLAYS = [
  {
    id: crypto.randomUUID(),
    name: 'Base Serve Receive',
    lineup: { ...DEFAULT_LINEUP },
    drawings: [],
  },
  {
    id: crypto.randomUUID(),
    name: 'Quick Middle Option',
    lineup: {
      '1': 'setter',
      '2': 'opposite',
      '3': 'middle-1',
      '4': 'outside-1',
      '5': 'libero',
      '6': 'outside-2',
    },
    drawings: [],
  },
];

const getRoleById = (roleId) =>
  ROLE_LIBRARY.find((role) => role.id === roleId) || null;

const deepClonePlay = (play) => ({
  ...play,
  lineup: { ...play.lineup },
  drawings: play.drawings.map((drawing) => ({ ...drawing })),
});

export default function CoachIBoard() {
  const navigate = useNavigate();
  const courtRef = useRef(null);

  const [plays, setPlays] = useState(DEFAULT_PLAYS);
  const [selectedPlayId, setSelectedPlayId] = useState(DEFAULT_PLAYS[0].id);
  const [tool, setTool] = useState('select');
  const [selectedColor, setSelectedColor] = useState(DRAWING_COLORS[0].value);
  const [draggingTokenId, setDraggingTokenId] = useState(null);
  const [drawingDraft, setDrawingDraft] = useState(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved);
      if (
        parsed &&
        Array.isArray(parsed.plays) &&
        parsed.plays.length > 0 &&
        typeof parsed.selectedPlayId === 'string'
      ) {
        setPlays(parsed.plays);
        setSelectedPlayId(parsed.selectedPlayId);
      }
    } catch {
      // Ignore bad local data and fall back to defaults.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ plays, selectedPlayId })
    );
  }, [plays, selectedPlayId]);

  const selectedPlay = useMemo(
    () => plays.find((play) => play.id === selectedPlayId) || plays[0],
    [plays, selectedPlayId]
  );

  const selectedLineup = selectedPlay?.lineup || DEFAULT_LINEUP;
  const selectedDrawings = selectedPlay?.drawings || [];

  const occupiedRoleIds = useMemo(
    () => new Set(Object.values(selectedLineup)),
    [selectedLineup]
  );

  const benchRoles = ROLE_LIBRARY.filter((role) => !occupiedRoleIds.has(role.id));

  const updateSelectedPlay = (updater) => {
    setPlays((currentPlays) =>
      currentPlays.map((play) => {
        if (play.id !== selectedPlayId) return play;
        return updater(play);
      })
    );
  };

  const handlePlayRename = (event) => {
    const nextName = event.target.value;
    updateSelectedPlay((play) => ({
      ...play,
      name: nextName,
    }));
  };

  const handleDuplicatePlay = () => {
    if (!selectedPlay) return;

    const duplicated = deepClonePlay(selectedPlay);
    duplicated.id = crypto.randomUUID();
    duplicated.name = `${selectedPlay.name} Copy`;

    setPlays((current) => [...current, duplicated]);
    setSelectedPlayId(duplicated.id);
  };

  const handleCreateBlankPlay = () => {
    const newPlay = {
      id: crypto.randomUUID(),
      name: `New Play ${plays.length + 1}`,
      lineup: { ...DEFAULT_LINEUP },
      drawings: [],
    };
    setPlays((current) => [...current, newPlay]);
    setSelectedPlayId(newPlay.id);
  };

  const handleResetLineup = () => {
    updateSelectedPlay((play) => ({
      ...play,
      lineup: { ...DEFAULT_LINEUP },
    }));
  };

  const handleClearDrawings = () => {
    updateSelectedPlay((play) => ({
      ...play,
      drawings: [],
    }));
  };

  const swapIntoSlot = (incomingRoleId, targetSlotId) => {
    updateSelectedPlay((play) => {
      const nextLineup = { ...play.lineup };
      const sourceSlotId = Object.entries(nextLineup).find(
        ([, roleId]) => roleId === incomingRoleId
      )?.[0];

      if (sourceSlotId === targetSlotId) {
        return play;
      }

      const targetRoleId = nextLineup[targetSlotId];
      nextLineup[targetSlotId] = incomingRoleId;

      if (sourceSlotId) {
        nextLineup[sourceSlotId] = targetRoleId;
      }

      return {
        ...play,
        lineup: nextLineup,
      };
    });
  };

  const handleRoleDragStart = (roleId) => {
    setDraggingTokenId(roleId);
  };

  const handleRoleDragEnd = () => {
    setDraggingTokenId(null);
  };

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
      startX: point.x,
      startY: point.y,
      endX: point.x,
      endY: point.y,
    });
  };

  const handleCourtPointerMove = (event) => {
    if (tool !== 'arrow' || !drawingDraft) return;

    const point = getRelativePoint(event);
    if (!point) return;

    setDrawingDraft((current) =>
      current
        ? {
            ...current,
            endX: point.x,
            endY: point.y,
          }
        : current
    );
  };

  const finishArrow = (event) => {
    if (tool !== 'arrow' || !drawingDraft) return;

    const point = getRelativePoint(event);
    if (!point) {
      setDrawingDraft(null);
      return;
    }

    const completed = {
      id: crypto.randomUUID(),
      startX: drawingDraft.startX,
      startY: drawingDraft.startY,
      endX: point.x,
      endY: point.y,
      color: selectedColor,
    };

    const distance =
      Math.abs(completed.endX - completed.startX) +
      Math.abs(completed.endY - completed.startY);

    if (distance < 2) {
      setDrawingDraft(null);
      return;
    }

    updateSelectedPlay((play) => ({
      ...play,
      drawings: [...play.drawings, completed],
    }));

    setDrawingDraft(null);
  };

  const cancelDraftIfNeeded = () => {
    if (drawingDraft) {
      setDrawingDraft(null);
    }
  };

  return (
    <div className="iboard-page">
      <aside className="iboard-sidebar">
        <div className="iboard-brand">
          <img src={logo} alt="VolleyOps" className="iboard-logo" />
          <div>
            <p className="iboard-eyebrow">VolleyOps</p>
            <h1>Coach iBoard</h1>
          </div>
        </div>

        <div className="iboard-section">
          <div className="section-header">
            <h2>Plays</h2>
            <button className="ghost-btn" onClick={handleCreateBlankPlay}>
              + New
            </button>
          </div>

          <div className="plays-list">
            {plays.map((play) => (
              <button
                key={play.id}
                className={`play-list-item ${
                  play.id === selectedPlayId ? 'active' : ''
                }`}
                onClick={() => setSelectedPlayId(play.id)}
              >
                <span className="play-list-title">{play.name}</span>
                <span className="play-list-meta">
                  {play.drawings.length} drawing{play.drawings.length === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>

          <button className="primary-btn" onClick={handleDuplicatePlay}>
            Duplicate Selected Play
          </button>
          <p className="helper-text">
            Duplicating preserves the original, so you can safely experiment.
          </p>
        </div>

        <div className="iboard-section">
          <h2>Tools</h2>
          <div className="tool-toggle">
            <button
              className={tool === 'select' ? 'active' : ''}
              onClick={() => setTool('select')}
            >
              Select
            </button>
            <button
              className={tool === 'arrow' ? 'active' : ''}
              onClick={() => setTool('arrow')}
            >
              Arrow
            </button>
          </div>

          <div className="color-picker">
            {DRAWING_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                className={`color-swatch ${
                  selectedColor === color.value ? 'active' : ''
                }`}
                style={{ backgroundColor: color.value }}
                onClick={() => setSelectedColor(color.value)}
                title={color.name}
                aria-label={color.name}
              />
            ))}
          </div>

          <div className="action-stack">
            <button className="secondary-btn" onClick={handleResetLineup}>
              Reset Lineup
            </button>
            <button className="secondary-btn" onClick={handleClearDrawings}>
              Clear Drawings
            </button>
          </div>
        </div>

        <div className="iboard-section">
          <h2>Bench / Role Tokens</h2>
          <p className="helper-text">
            Drag any role token onto a court slot to replace whoever is there.
          </p>

          <div className="bench-role-list">
            {ROLE_LIBRARY.map((role) => {
              const isOnCourt = occupiedRoleIds.has(role.id);
              return (
                <div
                  key={role.id}
                  className={`role-token ${isOnCourt ? 'on-court' : 'bench'}`}
                  draggable
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
            {benchRoles.length > 0
              ? benchRoles.map((role) => role.short).join(', ')
              : 'None'}
          </div>
        </div>
      </aside>

      <main className="iboard-main">
        <header className="iboard-topbar">
          <div>
            <p className="iboard-eyebrow">Interactive whiteboard</p>
            <input
              className="play-name-input"
              value={selectedPlay?.name || ''}
              onChange={handlePlayRename}
            />
          </div>

          <button className="back-btn" onClick={() => navigate('/')}>
            Back <span>&rarr;</span>
          </button>
        </header>

        <section className="iboard-summary-row">
          <div className="summary-card">
            <span className="summary-label">Current tool</span>
            <strong>{tool === 'arrow' ? 'Arrow drawing' : 'Select / Drag'}</strong>
          </div>
          <div className="summary-card">
            <span className="summary-label">Drawing color</span>
            <div className="color-label">
              <span
                className="color-dot"
                style={{ backgroundColor: selectedColor }}
              />
              <strong>{selectedColor}</strong>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-label">Default recovery</span>
            <strong>Reset Lineup</strong>
          </div>
        </section>

        <section className="court-shell">
          <div className="court-instructions">
            <span>
              <strong>Drag mode:</strong> move role tokens onto court slots to replace
              players.
            </span>
            <span>
              <strong>Arrow mode:</strong> click and drag on the court to draw.
            </span>
          </div>

          <div
            ref={courtRef}
            className={`volleyball-court ${tool === 'arrow' ? 'arrow-mode' : ''}`}
            onMouseDown={handleCourtPointerDown}
            onMouseMove={handleCourtPointerMove}
            onMouseUp={finishArrow}
            onMouseLeave={cancelDraftIfNeeded}
          >
            <svg className="court-drawings" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                {DRAWING_COLORS.map((color) => (
                  <marker
                    key={color.value}
                    id={`arrowhead-${color.value.replace('#', '')}`}
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill={color.value} />
                  </marker>
                ))}
              </defs>

              {selectedDrawings.map((drawing) => (
                <line
                  key={drawing.id}
                  x1={drawing.startX}
                  y1={drawing.startY}
                  x2={drawing.endX}
                  y2={drawing.endY}
                  stroke={drawing.color}
                  strokeWidth="1"
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
                  strokeWidth="1"
                  strokeDasharray="2 1.5"
                  strokeLinecap="round"
                />
              )}
            </svg>

            <div className="attack-line attack-line-top" />
            <div className="attack-line attack-line-bottom" />
            <div className="center-line" />

            {SLOT_LAYOUT.map((slot) => {
              const roleId = selectedLineup[slot.id];
              const role = getRoleById(roleId);

              return (
                <div
                  key={slot.id}
                  className="court-slot"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleSlotDrop(slot.id)}
                >
                  <div className="slot-label">{slot.label}</div>

                  <div
                    className={`court-player-token ${
                      draggingTokenId === roleId ? 'dragging' : ''
                    }`}
                    draggable={tool === 'select'}
                    onDragStart={() => handleRoleDragStart(roleId)}
                    onDragEnd={handleRoleDragEnd}
                    title={role?.label || ''}
                  >
                    <span className="role-short">{role?.short}</span>
                    <span className="role-label">{role?.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}