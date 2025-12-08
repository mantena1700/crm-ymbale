// Singleton para carregar Google Maps apenas uma vez
let isLoading = false;
let isLoaded = false;
const callbacks: Array<() => void> = [];

export function loadGoogleMaps(apiKey: string = 'AIzaSyASOKtEiW5F-NkwvjApo0NcMYab6OF3nlg'): Promise<void> {
    return new Promise((resolve, reject) => {
        // Se já está carregado, resolve imediatamente
        if (isLoaded || (window.google && window.google.maps)) {
            isLoaded = true;
            resolve();
            return;
        }

        // Se está carregando, adiciona callback para quando terminar
        if (isLoading) {
            callbacks.push(() => resolve());
            return;
        }

        // Verificar se já existe um script
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
            isLoading = true;
            // Aguardar o carregamento do script existente
            const checkLoaded = setInterval(() => {
                if (window.google && window.google.maps) {
                    clearInterval(checkLoaded);
                    isLoaded = true;
                    isLoading = false;
                    resolve();
                    // Executar callbacks pendentes
                    callbacks.forEach(cb => cb());
                    callbacks.length = 0;
                }
            }, 100);

            // Timeout após 10 segundos
            setTimeout(() => {
                clearInterval(checkLoaded);
                isLoading = false;
                if (!isLoaded) {
                    reject(new Error('Timeout ao carregar Google Maps'));
                }
            }, 10000);
            return;
        }

        // Iniciar carregamento
        isLoading = true;

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            isLoaded = true;
            isLoading = false;
            resolve();
            // Executar callbacks pendentes
            callbacks.forEach(cb => cb());
            callbacks.length = 0;
        };

        script.onerror = () => {
            isLoading = false;
            reject(new Error('Erro ao carregar Google Maps API'));
        };

        document.head.appendChild(script);
    });
}

export function isGoogleMapsLoaded(): boolean {
    return isLoaded || !!(window.google && window.google.maps);
}

