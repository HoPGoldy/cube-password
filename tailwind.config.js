// eslint-disable-next-line no-undef
module.exports = {
    darkMode: ['class', '[data-theme="dark"]'],
    content: [
        './src/**/*.{js,ts,jsx,tsx,html}'
    ],
    theme: {
        extend: {
            width: {
                'sidebar': 'var(--kmp-sidebar-width)',
                'page-content': 'calc(100vw - var(--kmp-sidebar-width))',
                // 实现凭证列表在不同屏幕上的列数不同
                'col-1': 'calc(100% - 1rem)',
                'col-2': 'calc(50% - 1rem)',
                'col-3': 'calc(33.3% - 1rem)'
            },
            height: {
                'bottombar': 'var(--kmp-bottombar-height)',
                'page-content': 'calc(100vh - var(--kmp-bottombar-height))'
            },
            transitionProperty: {
                'w': 'width',
                'h': 'height',
                'spacing': 'margin, padding',
            }
        }
    },
}
