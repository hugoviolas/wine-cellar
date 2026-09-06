import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#f4f1ea',
        forest: '#20342b',
        sage: '#6f8f6a',
        gold: '#c9a646',
        goldLight: '#d4af37',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
