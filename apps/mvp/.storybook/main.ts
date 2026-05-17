import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import path from "path";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  staticDirs: ["../public"],
  viteFinal: async (config) => {
    return mergeConfig(config, {
      define: {
        "process.env": {},
      },
      resolve: {
        alias: {
          "next/image": path.resolve(__dirname, "next-image-mock.jsx"),
          "next/navigation": path.resolve(__dirname, "next-navigation-mock.js"),
          "next/link": path.resolve(__dirname, "next-link-mock.jsx"),
        },
      },
    });
  },
};

export default config;
