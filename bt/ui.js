  const ui = document.getElementById("ui");
  let hideTimeout;

  function showUI() {
    ui.classList.remove("hidden");
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      ui.classList.add("hidden");
    }, 3000); // Hide after 3 seconds of inactivity
  }

  // User interactions that reset the timer and show the ui again
  ["mousemove", "keydown", "touchstart"].forEach(event =>
    window.addEventListener(event, showUI)
  );

  showUI(); // Start the timer
