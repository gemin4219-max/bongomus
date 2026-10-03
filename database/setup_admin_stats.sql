-- ============================================================================
-- Admin dashboard stats: ClickPesa revenue, app installs, accounts
-- Safe to run multiple times. Additive only (no data is dropped).
-- ============================================================================

-- 1. App installs (one row per device install, created on first app launch)
CREATE TABLE IF NOT EXISTS public.app_installs (
    install_id   TEXT PRIMARY KEY,
    platform     TEXT,
    app_version  TEXT,
    device_model TEXT,
    user_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    first_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on with NO policies: the table is only reachable through the functions below.
ALTER TABLE public.app_installs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_app_installs_first_seen ON public.app_installs(first_seen);
CREATE INDEX IF NOT EXISTS idx_app_installs_last_seen  ON public.app_installs(last_seen);

-- 2. Called by the app on every launch (anon or logged in)
CREATE OR REPLACE FUNCTION public.register_install(
    p_install_id   TEXT,
    p_platform     TEXT DEFAULT NULL,
    p_app_version  TEXT DEFAULT NULL,
    p_device_model TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_install_id IS NULL OR length(p_install_id) < 8 OR length(p_install_id) > 64 THEN
        RETURN;
    END IF;

    INSERT INTO app_installs (install_id, platform, app_version, device_model, user_id)
    VALUES (p_install_id, left(p_platform, 20), left(p_app_version, 20), left(p_device_model, 60), auth.uid())
    ON CONFLICT (install_id) DO UPDATE
       SET last_seen   = NOW(),
           app_version = COALESCE(EXCLUDED.app_version, app_installs.app_version),
           user_id     = COALESCE(auth.uid(), app_installs.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.register_install(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_install(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 3. Admin-only dashboard numbers (Tanzania time for "today" / "this month")
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_day_start   TIMESTAMPTZ := date_trunc('day',   NOW() AT TIME ZONE 'Africa/Dar_es_Salaam') AT TIME ZONE 'Africa/Dar_es_Salaam';
    v_month_start TIMESTAMPTZ := date_trunc('month', NOW() AT TIME ZONE 'Africa/Dar_es_Salaam') AT TIME ZONE 'Africa/Dar_es_Salaam';
    v_result      JSON;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND (role = 'admin' OR COALESCE(is_admin, FALSE))
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT json_build_object(
        -- ClickPesa revenue (TZS) — only completed payments count (Filtered from Sept 1st to simulate real data)
        'revenue_total',      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed' AND created_at >= '2026-09-01'::date),
        'revenue_today',      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed' AND created_at >= v_day_start),
        'revenue_month',      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed' AND created_at >= v_month_start),
        'credits_sold',       (SELECT COALESCE(SUM(credits_awarded), 0) FROM transactions WHERE status = 'completed' AND created_at >= '2026-09-01'::date),
        'payments_completed', (SELECT COUNT(*) FROM transactions WHERE status = 'completed' AND created_at >= '2026-09-01'::date),
        'payments_pending',   (SELECT COUNT(*) FROM transactions WHERE status = 'pending' AND created_at >= '2026-09-01'::date),
        'payments_failed',    (SELECT COUNT(*) FROM transactions WHERE status = 'failed' AND created_at >= '2026-09-01'::date),
        'paying_users',       (SELECT COUNT(DISTINCT user_id) FROM transactions WHERE status = 'completed' AND created_at >= '2026-09-01'::date),
        'revenue_last7', (
            SELECT json_agg(json_build_object('day', d::date, 'amount', COALESCE(t.total, 0)) ORDER BY d)
            FROM generate_series(
                (NOW() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - 6,
                (NOW() AT TIME ZONE 'Africa/Dar_es_Salaam')::date,
                INTERVAL '1 day'
            ) AS d
            LEFT JOIN (
                SELECT (created_at AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS day, SUM(amount) AS total
                FROM transactions
                WHERE status = 'completed'
                  AND created_at >= NOW() - INTERVAL '8 days'
                GROUP BY 1
            ) t ON t.day = d::date
        ),

        -- Accounts
        'accounts_total', (SELECT COUNT(*) FROM profiles),
        'accounts_today', (SELECT COUNT(*) FROM profiles WHERE created_at >= v_day_start),
        'accounts_month', (SELECT COUNT(*) FROM profiles WHERE created_at >= v_month_start),
        'artists_total',  (SELECT COUNT(*) FROM profiles WHERE role = 'artist'),

        -- App installs (tracked by the app itself)
        'installs_total',     (SELECT COUNT(*) FROM app_installs),
        'installs_android',   (SELECT COUNT(*) FROM app_installs WHERE platform = 'android'),
        'installs_ios',       (SELECT COUNT(*) FROM app_installs WHERE platform = 'ios'),
        'installs_today',     (SELECT COUNT(*) FROM app_installs WHERE first_seen >= v_day_start),
        'installs_month',     (SELECT COUNT(*) FROM app_installs WHERE first_seen >= v_month_start),
        'installs_active_7d', (SELECT COUNT(*) FROM app_installs WHERE last_seen >= NOW() - INTERVAL '7 days')
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
