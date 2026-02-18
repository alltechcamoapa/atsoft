/**
 * ALLTECH - State Management v2
 * Fixed: Mantiene isAuthenticated después del login
 */

const State = (() => {
    const STORAGE_KEY = 'alltech_support_state';
    let isInitialized = false;

    // Initial state structure
    const initialState = {
        theme: 'light',
        sidebarOpen: true,
        currentModule: 'dashboard',
        user: null,
        isAuthenticated: false,
        notifications: [],
        lastUpdated: null,
        companyConfig: {
            name: 'ALLTECH',
            logoUrl: 'assets/logo.png',
            sidebarColor: '#1a73e8'
        }
    };

    // Current state (private)
    let state = { ...initialState };

    // Subscribers for state changes
    const subscribers = new Set();

    // ========== PERSISTENCE ==========

    const loadFromStorage = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge con initial state
                state = { ...initialState, ...parsed };
                console.log('✅ State cargado desde localStorage:', { isAuthenticated: state.isAuthenticated, user: state.user?.name });
            }
        } catch (error) {
            console.warn('Failed to load state from storage:', error);
        }
    };

    const saveToStorage = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save state to storage:', error);
        }
    };

    // ========== STATE MANAGEMENT ==========

    const getState = () => Object.freeze({ ...state });

    const get = (key) => {
        const value = state[key];
        if (typeof value === 'object' && value !== null) {
            return Array.isArray(value) ? [...value] : { ...value };
        }
        return value;
    };

    const set = (key, value) => {
        const oldValue = state[key];

        if (oldValue === value) return;

        state = {
            ...state,
            [key]: value,
            lastUpdated: new Date().toISOString()
        };

        saveToStorage();
        notifySubscribers(key, value, oldValue);
    };

    const setNested = (path, value) => {
        const keys = path.split('.');
        const lastKey = keys.pop();

        let current = { ...state };
        let reference = current;

        for (const key of keys) {
            reference[key] = { ...reference[key] };
            reference = reference[key];
        }

        reference[lastKey] = value;
        state = { ...current, lastUpdated: new Date().toISOString() };

        saveToStorage();
        notifySubscribers(path, value);
    };

    const reset = () => {
        state = { ...initialState };
        saveToStorage();
        notifySubscribers('reset', state);
    };

    // ========== SUBSCRIPTIONS ==========

    const subscribe = (callback) => {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
    };

    const notifySubscribers = (key, newValue, oldValue) => {
        subscribers.forEach(callback => {
            try {
                callback(key, newValue, oldValue, getState());
            } catch (error) {
                console.error('Subscriber error:', error);
            }
        });
    };

    // ========== CONVENIENCE METHODS ==========

    const toggleTheme = () => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        set('theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const toggleSidebar = () => {
        set('sidebarOpen', !state.sidebarOpen);
    };

    const setCurrentModule = (module) => {
        set('currentModule', module);
    };

    const addNotification = (notification) => {
        const notifications = [...state.notifications, {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            read: false,
            ...notification
        }];
        set('notifications', notifications);
    };

    const markNotificationRead = (id) => {
        const notifications = state.notifications.map(n =>
            n.id === id ? { ...n, read: true } : n
        );
        set('notifications', notifications);
    };

    const setUserRole = (role) => {
        const currentUser = get('user');
        set('user', { ...currentUser, role });
    };

    const login = (user) => {
        console.log('✅ State.login() llamado con:', user);
        set('user', user);
        set('isAuthenticated', true);
        console.log('✅ State después de login:', { user: state.user, isAuthenticated: state.isAuthenticated });
    };

    const logout = () => {
        set('isAuthenticated', false);
        set('user', null);
    };

    const isLoggedIn = () => {
        return state.isAuthenticated === true;
    };

    const getCurrentUser = () => {
        return state.user;
    };

    // ========== INITIALIZATION ==========

    const init = () => {
        // Prevent double initialization
        if (isInitialized) {
            console.log('ℹ️ State ya inicializado, omitiendo...');
            return;
        }

        loadFromStorage();
        // Apply saved theme
        document.documentElement.setAttribute('data-theme', state.theme);
        isInitialized = true;
        console.log('✅ State inicializado:', { isAuthenticated: state.isAuthenticated, user: state.user?.name || 'N/A' });
    };

    // ========== PUBLIC API ==========
    return {
        init,
        getState,
        get,
        set,
        setNested,
        reset,
        subscribe,
        toggleTheme,
        toggleSidebar,
        setCurrentModule,
        addNotification,
        markNotificationRead,
        setUserRole,
        login,
        logout,
        isLoggedIn,
        getCurrentUser
    };
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = State;
}
