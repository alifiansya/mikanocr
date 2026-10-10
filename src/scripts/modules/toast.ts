export function showToast(
  message: string,
  type: "success" | "error" | "info" = "info",
  duration = 3200
) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-size: 14px; font-weight: bold;">${icons[type]}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function showProgress(visible: boolean) {
  const globalProgress = document.getElementById("global-progress");
  if (globalProgress) {
    globalProgress.style.display = visible ? "block" : "none";
  }
}
