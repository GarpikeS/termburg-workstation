/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4A7C59',
          light: '#7FA99B',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#7FA99B',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#E8DCC4',
          foreground: '#2D3436',
        },
        background: '#FAF8F4',
        foreground: '#2D3436',
        card: {
          DEFAULT: '#ffffff',
          foreground: '#2D3436',
        },
        muted: {
          DEFAULT: '#F4F0E8',
          foreground: '#6C757D',
        },
        destructive: '#d4183d',
        border: 'rgba(74, 124, 89, 0.15)',
        input: '#F8F6F1',
        ring: '#4A7C59',
        // Termburg brand
        'termo-green': '#4A7C59',
        'termo-green-light': '#7FA99B',
        'termo-beige': '#E8DCC4',
        'termo-sand': '#D4C5A0',
        'termo-gold': '#C4956C',
        // Gem colors
        'gem-water': '#6DB4C9',
        'gem-leaf': '#6EAA5E',
        'gem-stone': '#8B8D8F',
        'gem-steam': '#B8C9D9',
        'gem-fire': '#E88B5C',
        'gem-wood': '#8B6F47',
      },
      fontFamily: {
        heading: ['"Ikra Slab"', 'Georgia', 'serif'],
        body: ['"Proxima Nova"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
