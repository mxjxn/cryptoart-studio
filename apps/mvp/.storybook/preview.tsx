import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

// Mock next/navigation
const mockPush = (...args: any[]) => console.log("[router.push]", ...args);
const mockReplace = (...args: any[]) => console.log("[router.replace]", ...args);
const mockBack = () => console.log("[router.back]");

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
