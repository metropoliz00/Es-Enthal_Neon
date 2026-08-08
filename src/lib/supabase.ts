import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase URL from environment variables
export const getSupabaseUrl = (): string => {
    return (
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        ''
    ).trim();
};

// Get Supabase Key (Service Role or Anon Key) from environment variables
export const getSupabaseKey = (): string => {
    return (
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        ''
    ).trim();
};

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a initialized Supabase client instance using @supabase/supabase-js.
 * Returns null if SUPABASE_URL or key is not provided.
 */
export const getSupabaseClient = (): SupabaseClient | null => {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();

    if (!url || !key) {
        return null;
    }

    if (!cachedClient) {
        cachedClient = createClient(url, key, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
    }

    return cachedClient;
};

export const isSupabaseConfigured = (): boolean => {
    return Boolean(getSupabaseUrl() && getSupabaseKey());
};
