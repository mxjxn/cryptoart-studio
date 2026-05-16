import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

// Mock next/image — render plain <img> in Storybook
import * as NextImage from "next/image";

const OriginalImage = NextImage.default;
Object.defineProperty(NextImage, "default", {
  value: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <OriginalImage {...props} unoptimized />;
  },
});

// Mock next/navigation
const mockPush = (...args: any[]) => console.log("[router.push]", ...args);
const mockReplace = (...args: any[]) => console.log("[router.replace]", ...args);
const mockBack = () => console.log("[router.back]");

// @ts-ignore
import { useRouter } from "next/navigation";
// Can't easily mock hooks at module level in this setup,
// so we use a decorator pattern below instead.

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      navigation: {
        push: mockPush,
        replace: mockReplace,
        back: mockBack,
      },
    },
  },
  decorators: [
    (Story) => (
      <Story />
    ),
  ],
};

export default preview;
