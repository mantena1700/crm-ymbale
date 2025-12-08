// Declarações globais para o Google Maps API
interface Window {
    google: typeof google;
}

declare namespace google {
    namespace maps {
        class Map {
            constructor(mapDiv: Element, opts?: MapOptions);
            fitBounds(bounds: LatLngBounds): void;
            getZoom(): number | undefined;
            setZoom(zoom: number): void;
        }

        interface MapOptions {
            center?: LatLng | LatLngLiteral;
            zoom?: number;
            mapTypeControl?: boolean;
            streetViewControl?: boolean;
            fullscreenControl?: boolean;
        }

        class Marker {
            constructor(opts?: MarkerOptions);
            setMap(map: Map | null): void;
            addListener(eventName: string, handler: Function): MapsEventListener;
        }

        interface MarkerOptions {
            position?: LatLng | LatLngLiteral;
            map?: Map;
            title?: string;
            icon?: string | Icon | Symbol;
            label?: string | MarkerLabel;
        }

        interface MarkerLabel {
            text: string;
            color?: string;
            fontSize?: string;
            fontWeight?: string;
        }

        interface Icon {
            url: string;
            scaledSize?: Size;
        }

        interface Symbol {
            path: string | SymbolPath;
            scale?: number;
            fillColor?: string;
            fillOpacity?: number;
            strokeColor?: string;
            strokeWeight?: number;
        }

        enum SymbolPath {
            CIRCLE,
            FORWARD_CLOSED_ARROW,
            FORWARD_OPEN_ARROW,
            BACKWARD_CLOSED_ARROW,
            BACKWARD_OPEN_ARROW,
        }

        class LatLng {
            constructor(lat: number, lng: number);
            lat(): number;
            lng(): number;
        }

        interface LatLngLiteral {
            lat: number;
            lng: number;
        }

        class LatLngBounds {
            constructor();
            extend(point: LatLng | LatLngLiteral): void;
        }

        class Size {
            constructor(width: number, height: number);
        }

        class Geocoder {
            constructor();
            geocode(
                request: GeocoderRequest,
                callback: (
                    results: GeocoderResult[] | null,
                    status: GeocoderStatus
                ) => void
            ): void;
        }

        interface GeocoderRequest {
            address?: string;
            location?: LatLng | LatLngLiteral;
        }

        interface GeocoderResult {
            geometry: {
                location: LatLng;
            };
        }

        type GeocoderStatus = 'OK' | 'ZERO_RESULTS' | 'ERROR';

        class InfoWindow {
            constructor(opts?: InfoWindowOptions);
            open(map: Map, anchor: Marker): void;
            close(): void;
        }

        interface InfoWindowOptions {
            content?: string | Element;
        }

        interface MapsEventListener {
            remove(): void;
        }

        namespace event {
            function addListenerOnce(
                instance: any,
                eventName: string,
                handler: Function
            ): MapsEventListener;
        }
    }
}

