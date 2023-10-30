/* eslint-disable no-undef */
// eslint-disable-next-line no-undef
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx,html}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        'antd-dark': '#141414',
      },
      width: {
        // 实现凭证列表在不同屏幕上的列数不同
        'col-1': 'calc(100% - 1rem)',
        'col-2': 'calc(50% - 1rem)',
        'col-3': 'calc(33.3% - 1rem)',
      },
      height: {
        bottombar: 'var(--cube-password-bottombar-height)',
        'page-content': 'calc(100% - var(--cube-password-bottombar-height) - 1rem)',
      },
      transitionProperty: {
        w: 'width',
        h: 'height',
        spacing: 'margin, padding',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
