'use client';

import { useEffect } from 'react';

/**
 * Componente para otimizações mobile específicas
 */
export default function MobileOptimizations() {
  useEffect(() => {
    // Prevenir zoom duplo toque
    let lastTouchEnd = 0;
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });

    // Adicionar classe para PWA standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      document.body.classList.add('pwa-standalone');
    }

    // Detectar orientação
    const handleOrientationChange = () => {
      if (window.orientation === 90 || window.orientation === -90) {
        document.body.classList.add('landscape');
      } else {
        document.body.classList.remove('landscape');
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    handleOrientationChange();

    // Melhorar scroll em mobile
    if ('scrollBehavior' in document.documentElement.style) {
      document.documentElement.style.scrollBehavior = 'smooth';
    }

    // Prevenir pull-to-refresh acidental (opcional)
    let touchStartY = 0;
    const preventPullToRefresh = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      // Se estiver no topo e tentando fazer pull down, prevenir
      if (scrollTop === 0 && touchY > touchStartY) {
        // Permitir apenas se não houver scroll no conteúdo
        const hasScrollableContent = document.documentElement.scrollHeight > window.innerHeight;
        if (!hasScrollableContent) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('touchstart', preventPullToRefresh, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchend', preventDoubleTapZoom);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('touchstart', preventPullToRefresh);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return null;
}

