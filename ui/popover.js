// A <details data-popover> menu (the Display menu, the GM's 🔔 Activity) closes when you tap outside it, like the
// dialogs do; tapping its own button still toggles it. Installed once per page.

let installed = false;

export function installPopovers() {
  if (installed) return;
  installed = true;
  document.addEventListener('pointerdown', (e) => {
    for (const d of document.querySelectorAll('details[data-popover][open]')) if (!d.contains(e.target)) d.removeAttribute('open');
  }, true);
}
