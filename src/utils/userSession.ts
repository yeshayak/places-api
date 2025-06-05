/// <reference types="angular" />

interface UserSession {
  token: string;
  p21SoaUrl: string;
}

interface RootScope extends angular.IScope {
  userSession: UserSession;
}

export const getUserSession = (): UserSession | null => {
  const root = angular.element('#contextWindow').scope() as RootScope;
  if (!root || !root.userSession) {
    console.error('User session is not available.');
    return null;
  }

  return {
    token: root.userSession.token,
    p21SoaUrl: root.userSession.p21SoaUrl,
  };
};
