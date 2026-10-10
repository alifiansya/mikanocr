export function setupThemeToggle() {
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const themeIconMoon = document.getElementById("theme-icon-moon");
  const themeIconSun = document.getElementById("theme-icon-sun");

  function updateThemeIcons(isLight: boolean) {
    if (themeIconMoon && themeIconSun) {
      themeIconMoon.style.display = isLight ? "inline-block" : "none";
      themeIconSun.style.display = isLight ? "none" : "inline-block";
    }
  }

  function initTheme() {
    const isLight = document.documentElement.classList.contains("light");
    updateThemeIcons(isLight);
  }

  function toggleTheme() {
    const isLight = document.documentElement.classList.contains("light");
    if (isLight) {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      updateThemeIcons(false);
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
      updateThemeIcons(true);
    }
  }

  themeToggleBtn?.addEventListener("click", toggleTheme);
  initTheme();
}
