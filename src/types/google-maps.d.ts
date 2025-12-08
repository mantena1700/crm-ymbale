/* eslint-disable @typescript-eslint/no-explicit-any */
declare namespace google {
  namespace maps {
    class Map {
      constructor(element: HTMLElement, options?: any);
      setMapTypeId(mapTypeId: string): void;
      getCenter(): any;
      fitBounds(bounds: any): void;
    }
    
    class Marker {
      constructor(options?: any);
      setMap(map: Map | null): void;
      getPosition(): any;
      addListener(event: string, handler: () => void): void;
    }
    
    class DirectionsService {
      route(request: any): Promise<any>;
    }
    
    class DirectionsRenderer {
      constructor(options?: any);
      setDirections(directions: any): void;
      setMap(map: Map | null): void;
    }
    
    class Geocoder {
      geocode(request: any): Promise<any>;
    }
    
    class InfoWindow {
      constructor(options?: any);
      open(map: Map, marker: Marker): void;
    }
    
    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }
    
    class LatLngBounds {
      constructor();
      extend(point: any): void;
    }
    
    class TrafficLayer {
      constructor();
      setMap(map: Map | null): void;
    }
    
    const SymbolPath: {
      CIRCLE: any;
      FORWARD_CLOSED_ARROW: any;
      FORWARD_OPEN_ARROW: any;
      BACKWARD_CLOSED_ARROW: any;
      BACKWARD_OPEN_ARROW: any;
    };
    
    const Animation: {
      BOUNCE: any;
      DROP: any;
    };
    
    const TravelMode: {
      DRIVING: any;
      WALKING: any;
      BICYCLING: any;
      TRANSIT: any;
      [key: string]: any;
    };
    
    namespace geometry {
      namespace spherical {
        function computeDistanceBetween(from: any, to: any): number;
      }
    }
    
    interface DirectionsWaypoint {
      location: any;
      stopover?: boolean;
    }
  }
}
