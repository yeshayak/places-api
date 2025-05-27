/// <reference types="angular" />
export const getUserSession = () => {
    const root = angular.element('#contextWindow').scope();
    if (!root || !root.userSession) {
        console.error('User session is not available.');
        return null;
    }
    return {
        token: root.userSession.token,
        p21SoaUrl: root.userSession.p21SoaUrl,
    };
};
