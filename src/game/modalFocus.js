const returnTargets = new WeakMap();

export function showModal(modal) {
  if (!modal.classList.contains("active")) {
    returnTargets.set(modal, modal.ownerDocument.activeElement);
  }
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

export function hideModal(modal) {
  const document = modal.ownerDocument;
  if (modal.contains(document.activeElement)) {
    const target = returnTargets.get(modal);
    if (target?.isConnected && !modal.contains(target)) {
      target.focus({ preventScroll: true });
    }
    // A removed, hidden or disabled trigger may be unable to receive focus.
    if (modal.contains(document.activeElement)) document.activeElement.blur();
  }
  returnTargets.delete(modal);
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}
