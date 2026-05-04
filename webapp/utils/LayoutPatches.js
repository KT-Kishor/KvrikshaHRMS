sap.ui.define([], function () {
  "use strict";

  function applyNoSpacerPatch(cfg) {
    const appRootId = cfg?.appRootId;
    const paddingPx = Number.isFinite(cfg?.paddingPx) ? cfg.paddingPx : 20;
    const observe = cfg?.observe !== false;

    if (!appRootId) return; // nothing to do without a root

    // 1) Build a CSS-safe version of the root id for selectors (#id needs escaping for dots, etc.)
    const cssEscapedRootId = cssEscapeId(appRootId);

    // 2) Inject CSS exactly once (idempotent)
    injectSpacerCSS(cssEscapedRootId, paddingPx);

    // 3) Keep spacers dead on re-renders (idempotent)
    if (observe) startSpacerObserver(appRootId);
  }

  // --- injects a <style> tag once with our rules ---
  function injectSpacerCSS(cssEscapedRootId, paddingPx) {
    if (document.getElementById("corehr-spacer-patch")) return;

    const style = document.createElement("style");
    style.id = "corehr-spacer-patch";
    style.textContent = `
/* 1) Kill any UI5 "-spacer" div inside the app root */
#${cssEscapedRootId} div[id$="-spacer"] {
  display: none !important;
  height: 0 !important;
  min-height: 0 !important;
}

/* 2) Add bottom padding to the *real* scroll/content containers (Page & ObjectPage) */
#${cssEscapedRootId} .sapMPageScroll,
#${cssEscapedRootId} .sapMPageContent,
#${cssEscapedRootId} .sapUxAPObjectPageScroll,
#${cssEscapedRootId} .sapUxAPObjectPageWrapper,
#${cssEscapedRootId} .sapUxAPObjectPageContent {
  padding-bottom: ${paddingPx}px !important;
  box-sizing: border-box;
}
`;
    document.head.appendChild(style);
  }

  // --- observes the app root and zeroes any new "-spacer" nodes UI5 might inject later ---
  function startSpacerObserver(appRootId) {
    if (window._corehrSpacerObserverAttached) return; // already attached

    // The root may not exist *right at this tick*; wait till it does.
    const attach = () => {
      const root = document.getElementById(appRootId);
      if (!root) {
        requestAnimationFrame(attach);
        return;
      }

      // Zeroes one spacer div (display + dimensions)
      const zero = (el) => {
        el.style.display = "none";
        el.style.height = "0px";
        el.style.minHeight = "0px";
      };

      // Pass over current DOM
      const patchAll = () => {
        root.querySelectorAll('div[id$="-spacer"]').forEach(zero);
      };
      patchAll();

      // Watch future mutations and kill spacers immediately
      const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "childList") {
            m.addedNodes.forEach((n) => {
              if (n.nodeType === 1) {
                if (n.id && n.id.endsWith("-spacer")) zero(n);
                n.querySelectorAll?.('div[id$="-spacer"]').forEach(zero);
              }
            });
          } else if (m.type === "attributes" && m.target.id && m.target.id.endsWith("-spacer")) {
            zero(m.target);
          }
        }
      });

      obs.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });

      // Guard so we don't attach multiple observers on hot reloads
      window._corehrSpacerObserverAttached = true;
    };

    attach();
  }

  // Escapes a DOM id so it can be safely used in a CSS #id selector
  function cssEscapeId(id) {
    return String(id).replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
  }

  return {
    applyNoSpacerPatch,
  };
});
