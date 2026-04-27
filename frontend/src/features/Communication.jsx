import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useUser } from '../UserContextCore';
import { apiFetch } from '../lib/api';
import { normalizeRole, ROLES } from '../permissions';
import './Communication.css';

const CHANNEL_TYPES = {
  TEAM: 'TEAM',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  PUBLIC: 'PUBLIC',
  STAFF: 'STAFF',
};

const ALERT_TYPES = [
  { value: 'alert_schedule_change', label: 'Practice schedule' },
  { value: 'alert_match_update', label: 'Match update' },
  { value: 'alert_general', label: 'General alert' },
];

const ROLE_LABEL = {
  [ROLES.MANAGER]: 'Manager',
  [ROLES.COACH]: 'Coach',
  [ROLES.PLAYER]: 'Player',
};

const ATTENDANCE_OPTIONS = [
  { status: 'ATTENDING', label: 'Attending', shortLabel: 'Yes', color: '#22c55e' },
  { status: 'NOT_ATTENDING', label: 'Not Attending', shortLabel: 'No', color: '#ef4444' },
  { status: 'TENTATIVE', label: 'Tentative', shortLabel: 'Maybe', color: '#f59e0b' },
];

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function Communication() {
  const user = useUser();
  const navigate = useNavigate();
  const role = normalizeRole(user.role);

  const [overview, setOverview] = useState({
    role,
    capabilities: {},
    channels: [],
    notifications: [],
  });
  const [selectedChannelId, setSelectedChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [deletingChannelId, setDeletingChannelId] = useState(null);
  const [dismissingNotificationId, setDismissingNotificationId] = useState('');
  const [error, setError] = useState('');
  const [messageForm, setMessageForm] = useState({
    content: '',
    isAlert: false,
    isEventPoll: false,
    attachmentType: 'alert_general',
    isPinned: false,
  });
  const [channelForm, setChannelForm] = useState({
    name: '',
    type: CHANNEL_TYPES.TEAM,
    teamId: '',
  });
  const [teams, setTeams] = useState([]);

  const capabilities = overview.capabilities || {};
  const selectedChannel = useMemo(
    () => overview.channels.find((channel) => channel.id === selectedChannelId) || null,
    [overview.channels, selectedChannelId]
  );

  const loadOverview = async ({ preserveChannel = true } = {}) => {
    try {
      setLoadingOverview(true);
      const data = await apiFetch('/api/communications/overview', { token: user.token });
      const channels = data.channels || [];
      setOverview(data);

      const nextChannelId = preserveChannel && selectedChannelId && channels.some((item) => item.id === selectedChannelId)
        ? selectedChannelId
        : channels[0]?.id || null;
      setSelectedChannelId(nextChannelId);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadMessages = async (channelId) => {
    if (!channelId) {
      setMessages([]);
      return;
    }

    try {
      setLoadingMessages(true);
      const data = await apiFetch(`/api/communications/channels/${channelId}/messages`, {
        token: user.token,
      });
      setMessages(data || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadOverview({ preserveChannel: false });
  }, [user.token]);

  useEffect(() => {
    if (!selectedChannelId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedChannelId);
  }, [selectedChannelId, user.token]);

  useEffect(() => {
    if (!capabilities.canCreateChannel) {
      return;
    }

    const loadTeams = async () => {
      try {
        const data = await apiFetch('/api/teams', { token: user.token });
        setTeams(data || []);
      } catch {
        setTeams([]);
      }
    };

    loadTeams();
  }, [capabilities.canCreateChannel, user.token]);

  const submitMessage = async (event) => {
    event.preventDefault();
    if (!selectedChannelId || !messageForm.content.trim()) {
      return;
    }

    try {
      setIsSending(true);
      const payload = {
        content: messageForm.content.trim(),
        isPinned: Boolean(messageForm.isPinned),
      };

      if (messageForm.isEventPoll) {
        payload.attachmentType = 'event_poll';
        payload.isPinned = true;
      } else if (messageForm.isAlert) {
        payload.isAlert = true;
        payload.attachmentType = messageForm.attachmentType;
      }

      await apiFetch(`/api/communications/channels/${selectedChannelId}/messages`, {
        token: user.token,
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessageForm((prev) => ({
        ...prev,
        content: '',
        isEventPoll: false,
        isPinned: prev.isAlert ? true : false,
      }));

      await Promise.all([loadMessages(selectedChannelId), loadOverview()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const resetChannelForm = () => {
    setChannelForm({
      name: '',
      type: CHANNEL_TYPES.TEAM,
      teamId: '',
    });
    setEditingChannelId(null);
  };

  const startEditChannel = (channel) => {
    setEditingChannelId(channel.id);
    setChannelForm({
      name: channel.name,
      type: channel.type,
      teamId: channel.teamId ? String(channel.teamId) : '',
    });
  };

  const submitChannel = async (event) => {
    event.preventDefault();
    if (!channelForm.name.trim()) {
      return;
    }

    try {
      setIsCreatingChannel(true);
      const payload = {
        name: channelForm.name.trim(),
        type: channelForm.type,
      };

      if (channelForm.type === CHANNEL_TYPES.TEAM && channelForm.teamId) {
        payload.teamId = Number(channelForm.teamId);
      }

      const isEditing = Boolean(editingChannelId);
      const targetPath = isEditing
        ? `/api/communications/channels/${editingChannelId}`
        : '/api/communications/channels';

      await apiFetch(targetPath, {
        token: user.token,
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      resetChannelForm();
      await loadOverview({ preserveChannel: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const deleteChannel = async (channel) => {
    if (!channel?.id) {
      return;
    }
    const approved = window.confirm(`Delete ${channel.name}? This cannot be undone.`);
    if (!approved) {
      return;
    }

    try {
      setDeletingChannelId(String(channel.id));
      await apiFetch(`/api/communications/channels/${channel.id}`, {
        token: user.token,
        method: 'DELETE',
      });
      if (selectedChannelId === channel.id) {
        setSelectedChannelId(null);
      }
      await loadOverview({ preserveChannel: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingChannelId(null);
    }
  };

  const dismissNotification = async (notificationId) => {
    if (!notificationId) {
      return;
    }
    try {
      setDismissingNotificationId(notificationId);
      await apiFetch('/api/communications/notifications/dismiss', {
        token: user.token,
        method: 'POST',
        body: JSON.stringify({ notificationId }),
      });
      setOverview((prev) => ({
        ...prev,
        notifications: (prev.notifications || []).filter((item) => item.id !== notificationId),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setDismissingNotificationId('');
    }
  };

  const recordAttendance = async (messageId, status) => {
    try {
      await apiFetch('/api/communications/attendance', {
        token: user.token,
        method: 'POST',
        body: JSON.stringify({ messageId, status }),
      });
      await loadMessages(selectedChannelId);
    } catch (err) {
      setError(err.message);
    }
  };

  const isStaffType = channelForm.type === CHANNEL_TYPES.STAFF;
  const canUseStaffType = capabilities.canCreateStaffChannel;
  const canSendAlert = capabilities.canSendAlert;
  const canPinMessage = capabilities.canPinMessage;

  return (
    <div className="communication-page communication-anim-enter">
      <header className="communication-topbar glass">
        <div className="communication-brand">
          <img src={logo} alt="VolleyOps" className="brand-logo" />
          <div>
            <h1>Communication Center</h1>
            <p>Role-aware team messaging and update alerts</p>
          </div>
        </div>
        <div className="communication-topbar-actions">
          <span className={`role-pill role-${role.toLowerCase()}`}>{ROLE_LABEL[role] || role}</span>
          <button type="button" className="back-btn" onClick={() => navigate('/')}>
            Back <span>&rarr;</span>
          </button>
        </div>
      </header>

      {error && <p className="communication-error">{error}</p>}

      <div className="communication-layout">
        <aside className="channels-pane glass soft-rise">
          <div className="panel-title-row">
            <h2>Channels</h2>
            {loadingOverview && <span className="panel-status">Syncing...</span>}
          </div>

          <div className="channel-list">
            {overview.channels.map((channel, index) => (
              <button
                key={channel.id}
                type="button"
                className={`channel-card ${selectedChannelId === channel.id ? 'active' : ''}`}
                onClick={() => setSelectedChannelId(channel.id)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="channel-name-row">
                  <strong>{channel.name}</strong>
                  {channel.unreadCount > 0 && <span className="unread-chip">{channel.unreadCount}</span>}
                </div>
                <div className="channel-actions">
                  {channel.canEdit && (
                    <button
                      type="button"
                      className="icon-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        startEditChannel(channel);
                      }}
                      title="Edit channel"
                    >
                      Edit
                    </button>
                  )}
                  {channel.canDelete && (
                    <button
                      type="button"
                      className="icon-action danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteChannel(channel);
                      }}
                      disabled={deletingChannelId === String(channel.id)}
                      title="Delete channel"
                    >
                      {deletingChannelId === String(channel.id) ? '...' : 'Delete'}
                    </button>
                  )}
                </div>
                <span className="channel-meta">
                  {channel.memberCount} members
                  {channel.latestMessageAt ? ` - ${formatDateTime(channel.latestMessageAt)}` : ''}
                </span>
                {channel.latestMessagePreview && <p>{channel.latestMessagePreview}</p>}
              </button>
            ))}
            {!loadingOverview && overview.channels.length === 0 && (
              <p className="empty-state">No channels available for your role yet.</p>
            )}
          </div>

          {capabilities.canCreateChannel && (
            <form className="create-channel-card" onSubmit={submitChannel}>
              <h3>{editingChannelId ? 'Edit Channel' : 'Create Channel'}</h3>
              <input
                type="text"
                value={channelForm.name}
                onChange={(event) => setChannelForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g., #u18-lineup-updates"
                required
              />
              <select
                value={channelForm.type}
                onChange={(event) => setChannelForm((prev) => ({ ...prev, type: event.target.value }))}
              >
                <option value={CHANNEL_TYPES.TEAM}>Team Channel</option>
                <option value={CHANNEL_TYPES.ANNOUNCEMENT}>Announcement Channel</option>
                <option value={CHANNEL_TYPES.PUBLIC}>Public Channel</option>
                {canUseStaffType && <option value={CHANNEL_TYPES.STAFF}>Staff Channel</option>}
              </select>
              {channelForm.type === CHANNEL_TYPES.TEAM && (
                <select
                  value={channelForm.teamId}
                  onChange={(event) => setChannelForm((prev) => ({ ...prev, teamId: event.target.value }))}
                >
                  <option value="">Use your team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              )}
              {isStaffType && !canUseStaffType && (
                <p className="form-hint">Only managers can create staff channels.</p>
              )}
              <div className="row-actions">
                {editingChannelId && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={resetChannelForm}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" disabled={isCreatingChannel || (isStaffType && !canUseStaffType)}>
                  {isCreatingChannel ? (editingChannelId ? 'Saving...' : 'Creating...') : (editingChannelId ? 'Save' : 'Create')}
                </button>
              </div>
            </form>
          )}
        </aside>

        <main className="messages-pane glass soft-rise">
          <div className="panel-title-row">
            <h2>{selectedChannel ? selectedChannel.name : 'Select a channel'}</h2>
            {selectedChannel && <span className="panel-status">{selectedChannel.memberCount} members</span>}
          </div>

          <div className="message-stream">
            {loadingMessages && <p className="panel-status">Loading messages...</p>}
            {!loadingMessages && messages.length === 0 && (
              <p className="empty-state">No messages yet. Start the conversation.</p>
            )}
            {messages.map((message, index) => (
              <article
                key={message.id}
                className={`message-card ${message.senderId === user.id ? 'mine' : ''} ${message.isPinned ? 'pinned' : ''}`}
                style={{ animationDelay: `${index * 35}ms` }}
              >
                <div className="message-header">
                  <strong>{message.senderName}</strong>
                  <span>{formatDateTime(message.createdAt)}</span>
                </div>
                <p>{message.content}</p>
                <div className="message-tags">
                  {message.isPinned && !message.isEventPoll && <span className="tag tag-pinned">Pinned</span>}
                  {message.isEventPoll && <span className="tag" style={{ background: '#6b7bb8', color: 'white' }}>Event Poll</span>}
                  {message.attachmentType && !message.isEventPoll && <span className="tag">{message.attachmentType}</span>}
                </div>

                {message.isEventPoll && (
                  <div className="attendance-poll">
                    <p className="attendance-question">Will you attend?</p>
                    <div className="attendance-actions">
                      {ATTENDANCE_OPTIONS.map(({ status, label, color }) => {
                        const isSelected = message.userResponse === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            className="attendance-choice"
                            onClick={() => recordAttendance(message.id, status)}
                            style={{
                              border: `2px solid ${color}`,
                              background: isSelected ? color : 'transparent',
                              color: isSelected ? 'white' : color,
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {message.attendanceCounts && (
                      <p className="attendance-counts">
                        {message.attendanceCounts.ATTENDING} attending |{' '}
                        {message.attendanceCounts.NOT_ATTENDING} not attending |{' '}
                        {message.attendanceCounts.TENTATIVE} tentative
                      </p>
                    )}
                    {Array.isArray(message.attendanceResponses) && (
                      <div className="attendance-roster">
                        {ATTENDANCE_OPTIONS.map(({ status, shortLabel }) => {
                          const responders = message.attendanceResponses.filter((item) => item.status === status);
                          return (
                            <div className="attendance-group" key={status}>
                              <span className={`attendance-status status-${status.toLowerCase()}`}>{shortLabel}</span>
                              <div className="attendance-names">
                                {responders.length === 0 ? (
                                  <span className="attendance-muted">No responses</span>
                                ) : responders.map((response) => (
                                  <span className="attendance-person" key={`${message.id}-${response.userId}`}>
                                    {response.name}
                                    {response.position ? <small>{response.position}</small> : null}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        {message.attendancePending?.length > 0 && (
                          <div className="attendance-group pending">
                            <span className="attendance-status status-pending">Pending</span>
                            <div className="attendance-names">
                              {message.attendancePending.map((member) => (
                                <span className="attendance-person muted" key={`${message.id}-pending-${member.userId}`}>
                                  {member.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>

          <form className="composer" onSubmit={submitMessage}>
            <textarea
              value={messageForm.content}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="Type your update..."
              disabled={!selectedChannelId}
              rows={3}
            />
            <div className="composer-controls">
              {canSendAlert && (
                <label>
                  <input
                    type="checkbox"
                    checked={messageForm.isEventPoll}
                    onChange={(event) =>
                      setMessageForm((prev) => ({
                        ...prev,
                        isEventPoll: event.target.checked,
                        isAlert: false,
                      }))
                    }
                  />
                  Event poll (attendance)
                </label>
              )}
              {canSendAlert && !messageForm.isEventPoll && (
                <label>
                  <input
                    type="checkbox"
                    checked={messageForm.isAlert}
                    onChange={(event) =>
                      setMessageForm((prev) => ({
                        ...prev,
                        isAlert: event.target.checked,
                        isPinned: event.target.checked ? true : prev.isPinned,
                      }))
                    }
                  />
                  Send as alert
                </label>
              )}
              {messageForm.isAlert && !messageForm.isEventPoll && canSendAlert && (
                <select
                  value={messageForm.attachmentType}
                  onChange={(event) => setMessageForm((prev) => ({ ...prev, attachmentType: event.target.value }))}
                >
                  {ALERT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              {canPinMessage && !messageForm.isEventPoll && (
                <label>
                  <input
                    type="checkbox"
                    checked={messageForm.isPinned || messageForm.isAlert}
                    onChange={(event) => setMessageForm((prev) => ({ ...prev, isPinned: event.target.checked }))}
                    disabled={messageForm.isAlert}
                  />
                  Pin message
                </label>
              )}
              <button type="submit" disabled={isSending || !selectedChannelId || !messageForm.content.trim()}>
                {isSending ? 'Sending...' : messageForm.isEventPoll ? 'Post Event Poll' : 'Send'}
              </button>
            </div>
          </form>
        </main>

        <aside className="notifications-pane glass soft-rise">
          <div className="panel-title-row">
            <h2>Notifications</h2>
            <button type="button" className="text-button" onClick={() => loadOverview()}>
              Refresh
            </button>
          </div>
          <div className="notification-list">
            {overview.notifications.map((item, index) => (
              <article
                key={item.id || `${item.type}-${item.timestamp || index}-${index}`}
                className="notification-card"
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <div className="notification-top">
                  <span className={`notification-type type-${(item.type || '').toLowerCase()}`}>{item.type}</span>
                  <button
                    type="button"
                    className="icon-action danger"
                    onClick={() => dismissNotification(item.id)}
                    disabled={dismissingNotificationId === item.id}
                    title="Dismiss notification"
                  >
                    {dismissingNotificationId === item.id ? '...' : 'Dismiss'}
                  </button>
                </div>
                <h3>{item.title}</h3>
                <p>{item.message}</p>
                <time>{formatDateTime(item.timestamp)}</time>
              </article>
            ))}
            {!loadingOverview && overview.notifications.length === 0 && (
              <p className="empty-state">No recent updates.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
