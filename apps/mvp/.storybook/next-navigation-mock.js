// Mock next/navigation for Storybook
export const useRouter = () => ({
  push: (...args: any[]) => console.log("[router.push]", ...args),
  replace: (...args: any[]) => console.log("[router.replace]", ...args),
  back: () => console.log("[router.back]"),
  prefetch: () => {},
});

export const usePathname = () => "/";
export const useSearchParams = () => new URLSearchParams();
