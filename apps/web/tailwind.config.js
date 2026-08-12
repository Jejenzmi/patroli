/** Palet "Command Center" — gelap taktis dengan aksen amber & sian. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#05070C',
        abyss: '#0A0E17',
        panel: '#111726',
        panel2: '#161E31',
        line: '#1F2A40',
        muted: '#7A8AA6',
        ink: '#E6EDF7',
        amber: { DEFAULT: '#FFB020', soft: '#FFD27A', deep: '#B36F00' },
        cyan: { DEFAULT: '#22D3EE', soft: '#7FE7F7' },
        violet: { DEFAULT: '#A78BFA' },
        emerald: { DEFAULT: '#34D399' },
        danger: { DEFAULT: '#FF5A5A', soft: '#FF9A9A' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,176,32,.25), 0 8px 40px -12px rgba(255,176,32,.45)',
        panel: '0 1px 0 rgba(255,255,255,.04) inset, 0 20px 40px -24px rgba(0,0,0,.9)',
        ring: '0 0 0 1px rgba(255,255,255,.06)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px)',
        sheen: 'linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,0) 45%)',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(.85)', opacity: '.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        // Tanpa transform: elemen ber-transform menjadi acuan position:fixed
        // bagi anak-anaknya, sehingga dialog bisa melenceng dari layar.
        riseIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        ticker: { '0%': { opacity: '.35' }, '50%': { opacity: '1' }, '100%': { opacity: '.35' } },
      },
      animation: {
        pulseRing: 'pulseRing 2s cubic-bezier(.4,0,.6,1) infinite',
        sweep: 'sweep 2.4s linear infinite',
        riseIn: 'riseIn .35s ease-out both',
        ticker: 'ticker 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
