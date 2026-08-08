import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase URL from environment variables
export const getSupabaseUrl = (): string => {
    let url = (
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        'https://klteevegsvzqhtvdgsbr.supabase.co'
    ).trim().replace(/^["'<]+|["'>]+$/g, '');

    // If url is a PostgreSQL connection string (e.g. postgresql://postgres.ref:pass@host:port/postgres), convert to https://ref.supabase.co
    if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
        try {
            const match = url.match(/postgres\.([a-zA-Z0-9_-]+):/);
            if (match && match[1]) {
                return `https://${match[1]}.supabase.co`;
            }
        } catch (e) {
            // ignore
        }
    }
    return url || 'https://klteevegsvzqhtvdgsbr.supabase.co';
};

// Get Supabase Key (Service Role or Anon Key) from environment variables
export const getSupabaseKey = (): string => {
    return (
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        'sb_publishable_gIb9RPDROEUZ0yHhOs-KrQ_LYPUJcmI'
    ).trim().replace(/^["'<]+|["'>]+$/g, '');
};

let cachedClient: SupabaseClient | null = null;

/**
 * Returns an initialized Supabase client instance using @supabase/supabase-js.
 * Returns null if SUPABASE_URL or key is not provided.
 */
export const getSupabaseClient = (): SupabaseClient | null => {
    const url = getSupabaseUrl();
    const key = getSupabaseKey();

    if (!url || !key || !url.startsWith('http')) {
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
    return Boolean(getSupabaseClient());
};

