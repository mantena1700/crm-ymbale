// Utilitário global para carregar Google Maps API apenas uma vez
let mapsApiLoaded = false;
let mapsApiLoading = false;
let mapsApiCallbacks: (() => void)[] = [];

export function loadGoogleMapsAPI(callback: () => void) {
    // Se já está carregado, executar callback imediatamente
    if (window.google && window.google.maps) {
        callback();
        return;
    }

    // Adicionar callback à fila
    mapsApiCallbacks.push(callback);

    // Se já está carregando, apenas adicionar à fila
    if (mapsApiLoading) {
        return;
    }

    // Verificar se script já existe
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
        mapsApiLoading = true;
        // Aguardar carregamento
        const checkInterval = setInterval(() => {
            if (window.google && window.google.maps) {
                clearInterval(checkInterval);
                mapsApiLoaded = true;
                mapsApiLoading = false;
                mapsApiCallbacks.forEach(cb => cb());
                mapsApiCallbacks = [];
            }
        }, 100);
        return;
    }

    // Iniciar carregamento
    mapsApiLoading = true;
    const apiKey = (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'Ucc4RbcoUyECWqqXkwCrJNlSZhQ=').trim();
    
    console.log('🔵 Carregando Google Maps API...', { apiKeyLength: apiKey.length });
    
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,directions`;
    script.async = true;
    script.defer = true;
    script.id = 'google-maps-script';
    
    script.onload = () => {
        console.log('✅ Google Maps API carregada com sucesso!');
        mapsApiLoaded = true;
        mapsApiLoading = false;
        mapsApiCallbacks.forEach(cb => {
            try {
                cb();
            } catch (error) {
                console.error('Erro ao executar callback do Google Maps:', error);
            }
        });
        mapsApiCallbacks = [];
    };
    
    script.onerror = (error) => {
        console.error('❌ Erro ao carregar Google Maps API:', error);
        mapsApiLoading = false;
        mapsApiCallbacks.forEach(cb => {
            try {
                cb();
            } catch (err) {
                console.error('Erro ao executar callback de erro:', err);
            }
        });
        mapsApiCallbacks = [];
    };

    document.head.appendChild(script);
}

declare global {
    interface Window {
        google: any;
    }
}

