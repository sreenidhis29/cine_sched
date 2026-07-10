import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "surface-dim": "#131313",
        "surface-container": "#1f2020",
        "surface-tint": "#ffba20",
        "secondary": "#c9c6c5",
        "on-surface": "#e4e2e1",
        "on-secondary-fixed": "#1c1b1b",
        "secondary-container": "#4a4949",
        "primary-fixed-dim": "#ffba20",
        "on-tertiary-fixed-variant": "#474746",
        "on-tertiary-container": "#525151",
        "surface-variant": "#353535",
        "inverse-primary": "#7c5800",
        "on-error": "#690005",
        "primary-container": "#ffb800",
        "tertiary-container": "#c7c4c4",
        "on-surface-variant": "#d5c4ab",
        "surface-container-highest": "#353535",
        "primary-fixed": "#ffdea8",
        "inverse-surface": "#e4e2e1",
        "on-tertiary": "#313030",
        "surface-container-high": "#2a2a2a",
        "on-secondary": "#313030",
        "tertiary": "#e3e0df",
        "error-container": "#93000a",
        "surface-bright": "#393939",
        "secondary-fixed": "#e5e2e1",
        "background": "#131313",
        "on-secondary-fixed-variant": "#474646",
        "tertiary-fixed-dim": "#c8c6c5",
        "on-primary-fixed-variant": "#5e4200",
        "surface-container-low": "#1b1c1c",
        "on-secondary-container": "#bab8b7",
        "on-background": "#e4e2e1",
        "on-tertiary-fixed": "#1c1b1b",
        "primary": "#ffdca1",
        "surface-container-lowest": "#0e0e0e",
        "on-primary-container": "#6b4c00",
        "error": "#ffb4ab",
        "on-error-container": "#ffdad6",
        "outline-variant": "#514532",
        "outline": "#9e8f78",
        "secondary-fixed-dim": "#c9c6c5",
        "on-primary-fixed": "#271900",
        "tertiary-fixed": "#e5e2e1",
        "inverse-on-surface": "#303030",
        "surface": "#131313",
        "on-primary": "#412d00"
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      spacing: {
        "stack-sm": "8px",
        "margin-safe": "24px",
        "panel-padding": "20px",
        "unit": "4px",
        "stack-md": "16px",
        "stack-lg": "32px",
        "gutter": "16px"
      },
      fontFamily: {
        "mono-data": ["JetBrains Mono"],
        "label-md": ["Inter"],
        "headline-lg": ["Montserrat"],
        "display-lg": ["Montserrat"],
        "body-lg": ["Inter"],
        "body-md": ["Inter"],
        "headline-md": ["Montserrat"],
        "headline-lg-mobile": ["Montserrat"]
      },
      fontSize: {
        "mono-data": ["13px", {"lineHeight": "18px", "fontWeight": "500"}],
        "label-md": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "600"}],
        "headline-lg": ["32px", {"lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "700"}],
        "display-lg": ["48px", {"lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "body-lg": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
        "body-md": ["14px", {"lineHeight": "20px", "fontWeight": "400"}],
        "headline-md": ["20px", {"lineHeight": "28px", "fontWeight": "600"}],
        "headline-lg-mobile": ["24px", {"lineHeight": "32px", "fontWeight": "700"}]
      }
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries")
  ],
};
export default config;
