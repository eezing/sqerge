// Throws an error whose code is a number, not a string.
export default () => {
  throw new DOMException('The operation was aborted', 'AbortError');
};
