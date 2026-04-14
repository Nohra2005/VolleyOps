export const ROLES = {
  GUEST: 'GUEST',
  MANAGER: 'MANAGER',
  COACH: 'COACH',
  PLAYER: 'PLAYER',
};

const LEGACY_ROLE_MAP = {
  ADMIN: ROLES.MANAGER,
  ATHLETE: ROLES.PLAYER,
};

export const FEATURES = {
  SCHEDULING: 'Scheduling',
  TEAM_MANAGEMENT: 'Team Management',
  COMMUNICATION: 'Communication',
  ATHLETE_STATS: 'Athlete Stats',
  COACH_IBOARD: 'Coach iBoard',
  ADMIN_USERS: 'Admin Users',
};

export const normalizeRole = (role = '') => LEGACY_ROLE_MAP[role] || role || ROLES.GUEST;

export const getAllowedFeatures = (role) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === ROLES.MANAGER) {
    return [
      FEATURES.SCHEDULING,
      FEATURES.TEAM_MANAGEMENT,
      FEATURES.COMMUNICATION,
      FEATURES.ATHLETE_STATS,
      FEATURES.COACH_IBOARD,
      FEATURES.ADMIN_USERS,
    ];
  }

  if (normalizedRole === ROLES.COACH) {
    return [
      FEATURES.SCHEDULING,
      FEATURES.TEAM_MANAGEMENT,
      FEATURES.COMMUNICATION,
      FEATURES.ATHLETE_STATS,
      FEATURES.COACH_IBOARD,
    ];
  }

  if (normalizedRole === ROLES.PLAYER) {
    return [
      FEATURES.SCHEDULING,
      FEATURES.COMMUNICATION,
      FEATURES.ATHLETE_STATS,
    ];
  }

  return [];
};

export const canAccessFeature = (role, feature) => getAllowedFeatures(role).includes(feature);
export const canManageUsers = (role) => normalizeRole(role) === ROLES.MANAGER;
export const canAccessTeamManagement = (role) => canAccessFeature(role, FEATURES.TEAM_MANAGEMENT);
export const canAccessCoachBoard = (role) => canAccessFeature(role, FEATURES.COACH_IBOARD);
export const canAccessScheduling = (role) => canAccessFeature(role, FEATURES.SCHEDULING);
export const canEditScheduling = (role) => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === ROLES.MANAGER || normalizedRole === ROLES.COACH;
};
