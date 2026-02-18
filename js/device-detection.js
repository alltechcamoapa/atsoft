/**
 * ALLTECH - Device Detection
 * Detects device type and adds classes to body for better CSS targeting
 */

(function () {
    'use strict';

    /**
     * Detect device type based on screen width and user agent
     */
    function detectDevice() {
        const width = window.innerWidth;
        const userAgent = navigator.userAgent.toLowerCase();
        const body = document.body;

        // Remove previous device classes
        body.classList.remove('device-smartphone', 'device-tablet', 'device-desktop');
        body.classList.remove('device-ios', 'device-android', 'device-windows');
        body.classList.remove('is-touch', 'is-mouse');

        // Detect device type by width
        if (width < 768) {
            body.classList.add('device-smartphone');
        } else if (width >= 768 && width < 1280) {
            body.classList.add('device-tablet');
        } else {
            body.classList.add('device-desktop');
        }

        // Detect OS
        if (/(iphone|ipod|ipad)/i.test(userAgent)) {
            body.classList.add('device-ios');
        } else if (/android/i.test(userAgent)) {
            body.classList.add('device-android');
        } else if (/windows/i.test(userAgent)) {
            body.classList.add('device-windows');
        }

        // Detect touch capability
        const isTouch = ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0);

        if (isTouch) {
            body.classList.add('is-touch');
        } else {
            body.classList.add('is-mouse');
        }

        // Log device info (optional, for debugging)
        if (localStorage.getItem('debug_device') === 'true') {
            console.log('🔍 Device Detection:', {
                width: width,
                type: width < 768 ? 'smartphone' : width < 1280 ? 'tablet' : 'desktop',
                touch: isTouch,
                userAgent: userAgent.substring(0, 50) + '...'
            });
        }
    }

    /**
     * Adjust viewport meta tag for better mobile experience
     */
    function optimizeViewport() {
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
            // Prevent zoom on input focus for iOS
            if (document.body.classList.contains('device-ios')) {
                viewportMeta.setAttribute('content',
                    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
            }
        }
    }

    /**
     * Add safe area insets for notched devices (iPhone X+)
     */
    function addSafeAreaSupport() {
        const style = document.createElement('style');
        style.textContent = `
            @supports (padding-top: env(safe-area-inset-top)) {
                .header {
                    padding-top: calc(var(--spacing-md) + env(safe-area-inset-top));
                }
                
                .sidebar {
                    padding-top: env(safe-area-inset-top);
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Optimize for keyboard on mobile
     */
    function setupKeyboardOptimization() {
        if (document.body.classList.contains('device-smartphone')) {
            // Prevent page from shifting when keyboard appears
            let viewportHeight = window.innerHeight;

            window.addEventListener('resize', () => {
                if (window.innerHeight < viewportHeight) {
                    // Keyboard is probably open
                    document.body.classList.add('keyboard-open');
                } else {
                    document.body.classList.remove('keyboard-open');
                }
            });

            // Scroll input into view when focused
            document.addEventListener('focus', (e) => {
                if (e.target.matches('input, textarea, select')) {
                    setTimeout(() => {
                        e.target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }, 300);
                }
            }, true);
        }
    }

    /**
     * Improve click response on touch devices
     */
    function optimizeTouchResponsiveness() {
        if (document.body.classList.contains('is-touch')) {
            // Remove 300ms click delay on mobile
            document.addEventListener('touchstart', function () { }, { passive: true });

            // Add active state to buttons on touch
            document.addEventListener('touchstart', (e) => {
                if (e.target.closest('button, .btn, a')) {
                    e.target.closest('button, .btn, a').classList.add('touch-active');
                }
            }, { passive: true });

            document.addEventListener('touchend', (e) => {
                if (e.target.closest('button, .btn, a')) {
                    setTimeout(() => {
                        e.target.closest('button, .btn, a').classList.remove('touch-active');
                    }, 100);
                }
            }, { passive: true });

            // Add CSS for touch-active state
            const touchStyle = document.createElement('style');
            touchStyle.textContent = `
                .touch-active {
                    opacity: 0.7;
                    transform: scale(0.98);
                    transition: all 0.1s ease;
                }
            `;
            document.head.appendChild(touchStyle);
        }
    }

    /**
     * Optimize images for device pixel ratio
     */
    function optimizeImagesForDPI() {
        const dpr = window.devicePixelRatio || 1;
        document.body.setAttribute('data-dpr', dpr >= 2 ? 'high' : 'normal');

        if (dpr >= 2) {
            // Add class for high DPI displays
            document.body.classList.add('high-dpi');
        }
    }

    /**
     * Add orientation change detection
     */
    function setupOrientationDetection() {
        function handleOrientation() {
            if (window.innerWidth > window.innerHeight) {
                document.body.classList.add('orientation-landscape');
                document.body.classList.remove('orientation-portrait');
            } else {
                document.body.classList.add('orientation-portrait');
                document.body.classList.remove('orientation-landscape');
            }
        }

        handleOrientation();
        window.addEventListener('resize', handleOrientation);
        window.addEventListener('orientationchange', handleOrientation);
    }

    /**
     * Initialize all optimizations
     */
    function init() {
        detectDevice();
        optimizeViewport();
        addSafeAreaSupport();
        setupKeyboardOptimization();
        optimizeTouchResponsiveness();
        optimizeImagesForDPI();
        setupOrientationDetection();

        // Re-detect device on window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(detectDevice, 250);
        });

        // Log initialization
        console.log('✅ Device optimizations initialized');
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
