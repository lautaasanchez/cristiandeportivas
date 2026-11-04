const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', wide: '1340px', '2xl': '1536px' },
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), head: v('head'), zebra: v('zebra'), line: v('line'),
        ink: v('ink'), muted: v('muted'), strong: v('strong'), onstrong: v('on-strong'), cta: v('cta'), oncta: v('on-cta'), gold: v('gold'), cyan: v('cyan'),
        win: v('win'), loss: v('loss'), pend: v('pend'),
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
