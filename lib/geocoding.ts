export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/geocode-address`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function geocodePostcode(postcode: string): Promise<GeocodeResult | null> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/geocode-address`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ postcode }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}