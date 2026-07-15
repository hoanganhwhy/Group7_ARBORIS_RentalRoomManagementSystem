/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        // ARBORIS Premium Colors
        wood: {
          50: '#f5f0ec',
          100: '#eadfd6',
          200: '#d5bfaf',
          300: '#c09f87',
          400: '#ab8060',
          500: '#8b5e3c', // Wood Brown (Main)
          600: '#754f32',
          700: '#5e3f28',
          800: '#48301e',
          900: '#322115',
          950: '#1a110a',
        },
        cream: {
          50: '#faf9f8',
          100: '#f5f3f0', // Beige / Ivory
          200: '#eae6df',
          300: '#dfd8cf',
          400: '#d4cabe',
          500: '#c9bcae',
        },
        terra: {
          50: '#fffbf7',
          100: '#fef3eb',
          200: '#fce4d2',
          300: '#f8c9ac',
          400: '#f3a47a',
          500: '#e87d4d',
          600: '#d6633c',
          700: '#b34d30',
          800: '#8f402a',
          900: '#753725',
        },
        charcoal: {
          50: '#f6f6f6',
          100: '#e7e7e7',
          200: '#d1d1d1',
          300: '#b0b0b0',
          400: '#888888',
          500: '#6d6d6d',
          600: '#5b5b5b',
          700: '#4c4c4c',
          800: '#3c3c3c',
          900: '#2b2b2b',
          950: '#1a1a1a',
        },
        // Muted status colors adapted to premium theme
        sage: {
          50: '#f4f6f4',
          100: '#e4ebe4',
          500: '#7ba37b',
          600: '#5b855b',
        },
        amber: {
          50: '#fffbf0',
          100: '#fdf0cd',
          500: '#d9a05b',
          600: '#bf8642',
        },
        rose: {
          50: '#fdf3f4',
          100: '#fae4e6',
          500: '#c2767c',
          600: '#a3575d',
        },
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'card': '0 8px 30px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 12px 40px rgba(0, 0, 0, 0.08)',
        'elevated': '0 20px 40px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        'xl': '14px',
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '32px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
