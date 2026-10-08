// Portal authentication belongs to an imported session, not the browser global scope.
export const session = {
  authReady: Promise.resolve(),
  cmToken: null,
  cmUser: null,
  cmSessionReady: false,
  cmRefreshPromise: null,
};
