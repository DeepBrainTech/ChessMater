export function initRotateNotice() {
  const notice = document.getElementById("rotateNotice");
  if (!notice) return () => {};
  let dismissedInPortrait = false;

  function isPortrait() {
    if (window.matchMedia("(orientation: portrait)").matches) return true;
    if (window.matchMedia("(orientation: landscape)").matches) return false;
    return window.innerHeight > window.innerWidth;
  }

  function dismiss() {
    if (!notice.classList.contains("is-visible")) return;
    dismissedInPortrait = true;
    notice.classList.remove("is-visible");
  }

  function syncRotateNotice() {
    if (!isPortrait()) {
      dismissedInPortrait = false;
      notice.classList.remove("is-visible");
      return;
    }
    if (dismissedInPortrait) {
      notice.classList.remove("is-visible");
      return;
    }
    notice.classList.add("is-visible");
  }

  const onKey = (e) => {
    if (e.key === "Escape" && notice.classList.contains("is-visible")) dismiss();
  };

  notice.addEventListener("click", dismiss);
  document.addEventListener("keydown", onKey);

  const mq = window.matchMedia("(orientation: portrait)");
  if (mq.addEventListener) mq.addEventListener("change", syncRotateNotice);
  else if (mq.addListener) mq.addListener(syncRotateNotice);
  window.addEventListener("resize", syncRotateNotice);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncRotateNotice);
  }
  syncRotateNotice();

  return () => {
    notice.removeEventListener("click", dismiss);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", syncRotateNotice);
  };
}
