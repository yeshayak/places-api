/// <reference types="angular" />

interface UserSession {
  token: string;
  p21SoaUrl: string;
}

interface RootScope extends angular.IScope {
  userSession: UserSession;
}

export const getUserSession = (): UserSession | null => {
  const ng = (window as any).angular;
  const element = document.querySelector('#contextWindow, [window_classname]');
  const scope = ng && element ? (ng.element(element).scope() as RootScope) : null;

  if (!scope || !scope.userSession) {
    console.error('User session is not available.');
    return null;
  }

  return {
    token: scope.userSession.token,
    p21SoaUrl: scope.userSession.p21SoaUrl,
  };
};
