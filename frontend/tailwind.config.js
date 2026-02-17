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
          DEFAULT: '#BA9B4F',
          light: '#A88A3D',
        },
        accent: {
          DEFAULT: '#D4956A',
          light: '#E8B896',
        },
        background: '#FAF6E8',
        surface: {
          DEFAULT: '#FFFFFF',
          warm: '#F0EBD8',
        },
        'text-primary': '#2D2B3D',
        'text-secondary': '#6B6880',
        success: '#5DB879',
        info: '#6AABDA',
        'warm-gold': '#D9CBA1',
        border: '#E0D9C8',
        'dark-surface': '#1E1A2E',
        'dark-surface-warm': '#2A2438',
        'dark-border': '#3C3558',
        // Gem colors
        'gem-water': '#6AABDA',
        'gem-leaf': '#5DB879',
        'gem-stone': '#8E8E9E',
        'gem-steam': '#9B7EC8',
        'gem-fire': '#D4956A',
        'gem-wood': '#A0784C',
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
