/**
 * PicSpeeder - Interaction Controller
 * Handles user mouse events, long-press gestures, and hides out-of-bounds clicks.
 */

(function() {
  let pressTimer = null;
  let delayShowProgressTimer = null; // Buffer timer before drawing radial progress
  let isLongPress = false;
  let targetImage = null;

  const LONG_PRESS_DELAY = 300; 
  const SHOW_PROGRESS_DELAY = 100; // Wait 100ms to filter out casual single clicks

  function isValidTarget(el) {
    return el && el.tagName === 'IMG';
  }

  document.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return; // Process left-clicks only

    // Ignore if click lands directly inside our toolbars
    if (e.target.closest('div') && e.target.closest('div').style.zIndex === '999999') {
      return;
    }

    let elements = document.elementsFromPoint(e.clientX, e.clientY);
    const isOverToolbar = elements.some(el => el.style && el.style.zIndex === '999999');
    if (isOverToolbar) return;

    // Determine if the user is grabbing the browser scrollbar tracks
    const isClickOnVerticalScrollbar = e.clientX >= document.documentElement.clientWidth;
    const isClickOnHorizontalScrollbar = e.clientY >= document.documentElement.clientHeight;

    targetImage = elements.find(el => isValidTarget(el));

    // Hide all panels if the click lands out of targets and scrollbars
    if (!targetImage && !isClickOnVerticalScrollbar && !isClickOnHorizontalScrollbar) {
      const allToolbars = document.querySelectorAll('div');
      allToolbars.forEach(div => {
        if (div.style && div.style.zIndex === '999999') {
          div.style.display = 'none';
        }
      });
    }

    if (targetImage) {
      isLongPress = false;

      // Delayed radial progress loader init
      delayShowProgressTimer = setTimeout(() => {
        // Adjust radial speed to sync up exactly at 300ms mark
        window.ImagePlayerUI.showProgress(e.clientX, e.clientY, LONG_PRESS_DELAY - SHOW_PROGRESS_DELAY);
      }, SHOW_PROGRESS_DELAY);

      // Core 300ms registration timer
      pressTimer = setTimeout(() => {
        isLongPress = true;
        if (delayShowProgressTimer) { clearTimeout(delayShowProgressTimer); delayShowProgressTimer = null; }
        window.ImagePlayerUI.removeProgress();
        window.ImagePlayerUI.create(targetImage);
      }, LONG_PRESS_DELAY);
    }
  });

  document.addEventListener('mouseup', function(e) {
    // Abort progress draw if button is released within 100ms
    if (delayShowProgressTimer) {
      clearTimeout(delayShowProgressTimer);
      delayShowProgressTimer = null;
    }
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    window.ImagePlayerUI.removeProgress();
  });

  document.addEventListener('mousemove', function(e) {
    if (pressTimer && !isLongPress) {
      if (delayShowProgressTimer) {
        clearTimeout(delayShowProgressTimer);
        delayShowProgressTimer = null;
      }
      clearTimeout(pressTimer);
      pressTimer = null;
      window.ImagePlayerUI.removeProgress();
    }
  });

  document.addEventListener('click', function(e) {
    // Stop native event chaining if long press action succeeds
    if (isLongPress) { e.preventDefault(); e.stopPropagation(); isLongPress = false; }
  }, true);

  document.addEventListener('contextmenu', function(e) {
    if (isLongPress) e.preventDefault();
  }, true);
})();
