export const THEMES = [
  { id: "void", label: "Void", icon: "✦" },
  { id: "light", label: "Light", icon: "☼" },
  { id: "system", label: "System", icon: "◩" },
];

export const getStoredTheme = () => localStorage.getItem("theme") || "void";

export const applyTheme = (theme = getStoredTheme()) => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "void" || (theme === "system" && prefersDark);
  const root = document.documentElement;
  
    root.style.setProperty("--bg-void", "#000000");
    root.style.setProperty("--bg-surface", "rgba(5, 5, 5, 0.85)");
    root.style.setProperty("--bg-glass", "rgba(255, 255, 255, 0.03)");
    root.style.setProperty("--border-thin", "rgba(255, 255, 255, 0.15)");
    root.style.setProperty("--text-primary", "#ffffff");
    root.style.setProperty("--text-secondary", "rgba(255, 255, 255, 0.7)");
    root.style.setProperty("--text-muted", "rgba(255, 255, 255, 0.4)");
    root.style.setProperty("--bg-void", "#ffffff");
    root.style.setProperty("--bg-surface", "rgba(250, 250, 250, 0.9)");
    root.style.setProperty("--bg-glass", "rgba(0, 0, 0, 0.03)");
    root.style.setProperty("--border-thin", "rgba(0, 0, 0, 0.15)");
    root.style.setProperty("--text-primary", "#000000");
    root.style.setProperty("--text-secondary", "rgba(0, 0, 0, 0.7)");
    root.style.setProperty("--text-muted", "rgba(0, 0, 0, 0.4)");
  }
};
