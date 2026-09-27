import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface Region {
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  /** Posição arredondada (~1 km): nunca guardamos o endereço exato */
  lat: number;
  lng: number;
}

/** Arredonda para 2 casas decimais (~1,1 km no Brasil). */
export const approx = (n: number) => Math.round(n * 100) / 100;

/**
 * Descobre bairro e cidade pelo GPS do celular. O próprio sistema (Google no Android,
 * Apple no iPhone) converte a coordenada em endereço, sem chave de API.
 * Lança um erro com mensagem em português se não der.
 */
export async function detectRegion(): Promise<Region> {
  if (Platform.OS === 'web') throw new Error('No navegador não dá para descobrir o bairro. Use o app no celular ou digite abaixo.');

  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('Sem permissão de localização. Libere nas configurações do celular ou digite o bairro.');

  // Posição recente (rápida) ou uma nova com precisão média, que já basta para achar o bairro
  const pos =
    (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000, requiredAccuracy: 2000 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const { latitude, longitude } = pos.coords;

  let place: Location.LocationGeocodedAddress | undefined;
  try {
    [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
  } catch {
    // Sem internet ou geocoder indisponível: fica só com a posição aproximada
  }

  return {
    neighborhood: place?.district || place?.subregion || null,
    city: place?.city || place?.subregion || null,
    state: place?.region || null,
    lat: approx(latitude),
    lng: approx(longitude),
  };
}

/** Distância em km entre duas posições (fórmula de Haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
