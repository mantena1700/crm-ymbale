'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Sidebar.module.css';

// Context for sidebar state
export const SidebarContext = createContext<{
    isCollapsed: boolean;
    setIsCollapsed: (value: boolean) => void;
}>({
    isCollapsed: false,
    setIsCollapsed: () => {}
});

export const useSidebar = () => useContext(SidebarContext);

interface NavItem {
    href: string;
    icon: string;
    label: string;
    badge?: number;
    adminOnly?: boolean;
    permission?: string; // código de permissão necessária
}

interface NavSection {
    title: string;
    items: NavItem[];
}

interface UserInfo {
    id: string;
    username: string;
    name: string;
    role: 'admin' | 'user';
}

interface SystemSettings {
    crmName: string;
    crmLogo: string | null;
    primaryColor: string;
}

const Sidebar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [notifications, setNotifications] = useState(0);
    const [pendingFollowUps, setPendingFollowUps] = useState(0);
    const [user, setUser] = useState<UserInfo | null>(null);
    const [settings, setSettings] = useState<SystemSettings>({
        crmName: 'Ymbale',
        crmLogo: null,
        primaryColor: '#2563eb',
    });
    const [loggingOut, setLoggingOut] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    // Buscar informações do usuário
    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                if (data.authenticated) {
                    setUser(data.user);
                }
            })
            .catch(() => {});
    }, []);

    // Buscar configurações do sistema
    useEffect(() => {
        fetch('/api/system-settings')
            .then(res => res.json())
            .then(data => {
                if (data) {
                    setSettings({
                        crmName: data.crmName || 'Ymbale',
                        crmLogo: data.crmLogo,
                        primaryColor: data.primaryColor || '#2563eb',
                    });
                }
            })
            .catch(() => {});
    }, []);

    // Buscar contadores reais (notificações e follow-ups)
    useEffect(() => {
        const fetchCounts = () => {
            fetch('/api/sidebar-counts')
                .then(res => res.json())
                .then(data => {
                    setNotifications(data.notifications || 0);
                    setPendingFollowUps(data.pendingFollowUps || 0);
                })
                .catch(() => {});
        };
        
        fetchCounts();
        // Atualizar a cada 60 segundos
        const interval = setInterval(fetchCounts, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
        } catch (error) {
            console.error('Erro no logout:', error);
        }
    };

    // Menu completo com todas as funcionalidades
    const navSections: NavSection[] = [
        {
            title: '',
            items: [
                { href: '/', icon: '🏠', label: 'Dashboard', permission: 'dashboard.view' },
            ]
        },
        {
            title: 'VENDAS',
            items: [
                { href: '/clients', icon: '👥', label: 'Leads', permission: 'clients.view' },
                { href: '/pipeline', icon: '📊', label: 'Pipeline', permission: 'pipeline.view' },
                { href: '/agenda', icon: '📅', label: 'Agenda', badge: pendingFollowUps, permission: 'agenda.view' },
                { href: '/campaigns', icon: '📧', label: 'Campanhas', permission: 'campaigns.view' },
            ]
        },
        {
            title: 'GESTÃO',
            items: [
                { href: '/carteira', icon: '🗺️', label: 'Carteira', permission: 'carteira.view' },
                { href: '/goals', icon: '🎯', label: 'Metas', permission: 'goals.view' },
                { href: '/sellers', icon: '👔', label: 'Equipe', permission: 'sellers.view' },
            ]
        },
        {
            title: 'ANÁLISES',
            items: [
                { href: '/batch-analysis', icon: '🤖', label: 'Análise IA', permission: 'analysis.view' },
                { href: '/reports', icon: '📈', label: 'Relatórios', permission: 'reports.view' },
                { href: '/insights', icon: '💡', label: 'Insights', permission: 'insights.view' },
            ]
        },
        {
            title: 'COMUNICAÇÃO',
            items: [
                { href: '/whatsapp', icon: '💬', label: 'WhatsApp', permission: 'whatsapp.view' },
            ]
        },
        {
            title: 'SISTEMA',
            items: [
                { href: '/settings', icon: '⚙️', label: 'Configurações', adminOnly: true, permission: 'settings.view' },
                { href: '/users', icon: '👤', label: 'Usuários', adminOnly: true, permission: 'users.view' },
                { href: '/admin/zonas', icon: '🗺️', label: 'Zonas de Atendimento', adminOnly: true, permission: 'settings.view' },
            ]
        }
    ];

    // Load collapsed state from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        if (saved) {
            setIsCollapsed(JSON.parse(saved));
        }
    }, []);

    // Save collapsed state
    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
    }, [isCollapsed]);

    // Aplicar classe no body para controlar o layout
    useEffect(() => {
        if (isCollapsed) {
            document.body.classList.add('sidebar-collapsed');
        } else {
            document.body.classList.remove('sidebar-collapsed');
        }

        // Cleanup
        return () => {
            document.body.classList.remove('sidebar-collapsed');
        };
    }, [isCollapsed]);

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    // Close mobile menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isMobileOpen) {
                const target = event.target as HTMLElement;
                if (!target.closest(`.${styles.sidebar}`) && !target.closest(`.${styles.mobileToggle}`)) {
                    setIsMobileOpen(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMobileOpen]);

    // Swipe gestures para mobile
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let touchStartX = 0;
        let touchEndX = 0;

        const handleTouchStart = (e: TouchEvent) => {
            touchStartX = e.changedTouches[0].screenX;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        };

        const handleSwipe = () => {
            const swipeThreshold = 50;
            const diff = touchStartX - touchEndX;

            // Swipe da esquerda para direita (abrir menu)
            if (diff < -swipeThreshold && touchStartX < 50 && !isMobileOpen) {
                setIsMobileOpen(true);
            }
            // Swipe da direita para esquerda (fechar menu)
            else if (diff > swipeThreshold && isMobileOpen) {
                setIsMobileOpen(false);
            }
        };

        // Aplicar apenas em mobile
        if (window.innerWidth <= 768) {
            document.addEventListener('touchstart', handleTouchStart, { passive: true });
            document.addEventListener('touchend', handleTouchEnd, { passive: true });
        }

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isMobileOpen]);

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
            {/* Mobile Toggle */}
            <button 
                className={styles.mobileToggle}
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                aria-label="Toggle menu"
            >
                <div className={`${styles.hamburger} ${isMobileOpen ? styles.active : ''}`}>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </button>

            {/* Mobile Overlay */}
            {isMobileOpen && <div className={styles.overlay} onClick={() => setIsMobileOpen(false)} />}

            {/* Sidebar */}
            <aside className={`
                ${styles.sidebar} 
                ${isCollapsed ? styles.collapsed : ''} 
                ${isMobileOpen ? styles.mobileOpen : ''}
            `}>
                {/* Logo */}
                <div className={styles.logoSection}>
                    <div className={styles.logo}>
                        {settings.crmLogo ? (
                            <div className={styles.logoImage}>
                                <img src={settings.crmLogo} alt={settings.crmName} />
                            </div>
                        ) : (
                            <div className={styles.logoIcon}>
                                <span>{settings.crmName.charAt(0).toUpperCase()}</span>
                            </div>
                        )}
                        {!isCollapsed && (
                            <div className={styles.logoText}>
                                <span className={styles.logoName}>{settings.crmName}</span>
                                <span className={styles.logoSub}>CRM</span>
                            </div>
                        )}
                    </div>
                    <button 
                        className={styles.collapseButton}
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                    >
                        <span className={`${styles.collapseIcon} ${isCollapsed ? styles.rotated : ''}`}>
                            ‹
                        </span>
                    </button>
                </div>

                {/* Navigation */}
                <nav className={styles.nav}>
                    {navSections.map((section) => {
                        // Filtrar itens baseado na permissão do usuário
                        const filteredItems = section.items.filter(item => {
                            if (item.adminOnly && user?.role !== 'admin') return false;
                            return true;
                        });

                        if (filteredItems.length === 0) return null;

                        return (
                            <div key={section.title} className={styles.section}>
                                {!isCollapsed && (
                                    <div className={styles.sectionTitle}>{section.title}</div>
                                )}
                                {filteredItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`${styles.navLink} ${isActive(item.href) ? styles.active : ''}`}
                                        title={isCollapsed ? item.label : undefined}
                                    >
                                        <span className={styles.navIcon}>{item.icon}</span>
                                        {!isCollapsed && (
                                            <>
                                                <span className={styles.navLabel}>{item.label}</span>
                                                {item.badge && item.badge > 0 && (
                                                    <span className={styles.badge}>{item.badge}</span>
                                                )}
                                            </>
                                        )}
                                        {isCollapsed && item.badge && item.badge > 0 && (
                                            <span className={styles.badgeDot}></span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                {/* User Profile */}
                <div className={styles.userSection}>
                    <Link href="/profile" className={styles.userProfile}>
                        <div className={styles.avatar}>
                            <span>{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
                            <span className={styles.onlineIndicator}></span>
                        </div>
                        {!isCollapsed && (
                            <div className={styles.userInfo}>
                                <span className={styles.userName}>{user?.name || 'Usuário'}</span>
                                <span className={styles.userRole}>
                                    {user?.role === 'admin' ? '👑 Administrador' : '👤 Usuário'}
                                </span>
                            </div>
                        )}
                    </Link>
                    {!isCollapsed && (
                        <button 
                            className={styles.logoutButton} 
                            title="Sair"
                            onClick={handleLogout}
                            disabled={loggingOut}
                        >
                            {loggingOut ? '⏳' : '🚪'}
                        </button>
                    )}
                </div>
            </aside>
        </SidebarContext.Provider>
    );
};

export default Sidebar;
