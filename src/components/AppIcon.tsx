export function AppIcon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    today: "M4 12h16M7 6v12M4 8v8M17 6v12M20 8v8",
    plan: "M5 4h14v17H5zM8 8h8M8 12h8M8 16h5",
    history: "M4 19V9M10 19V5M16 19v-7M22 19H2",
    build: "M12 4v16M4 12h16",
    profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3",
    arrow: "M4 12h15M13 6l6 6-6 6",
    clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    exit: "M10 4H4v16h6M9 12h12M16 7l5 5-5 5",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.today} />
    </svg>
  );
}
