(function initScorebookSupabase(global) {
  const SUPABASE_CONFIGS = {
    prod: {
      label: "production",
      url: "https://oxtikmowvunvicgvvdqa.supabase.co",
      publishableKey: "sb_publishable_LGv3_bhJ1K2xpGQmP8Wktw_-etjR4O1"
    },
    qa: {
      label: "qa",
      url: "https://cznbndvrsrurozpdoggb.supabase.co",
      publishableKey: "sb_publishable_-G5NtenqSf1Z2_xSvdx6pg_7ZuU_PCH"
    }
  };

  function detectEnvironment() {
    const params = new URLSearchParams(global.location?.search || "");
    const queryOverride = String(params.get("supabaseEnv") || "").trim().toLowerCase();
    const storedOverride = String(global.localStorage?.getItem("oakmont:supabaseEnv") || "").trim().toLowerCase();
    const override = queryOverride || storedOverride;
    if (override === "prod" || override === "qa") return override;
    const hostname = String(global.location?.hostname || "").trim().toLowerCase();
    if (hostname === "www.oakmontlions.com" || hostname === "oakmontlions.com") return "prod";
    return "qa";
  }

  const environment = detectEnvironment();
  const selectedConfig = SUPABASE_CONFIGS[environment] || SUPABASE_CONFIGS.prod;
  const SUPABASE_URL = selectedConfig.url;
  const SUPABASE_PUBLISHABLE_KEY = selectedConfig.publishableKey;

  let client = null;

  function configured() {
    return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
  }

  function available() {
    return Boolean(global.supabase?.createClient);
  }

  function getClient() {
    if (!configured()) return null;
    if (!available()) {
      console.warn("Supabase client library is not available.");
      return null;
    }
    if (!client) {
      client = global.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        global: {
          headers: {
            "x-application-name": "oakmont-lions-scorebook"
          }
        }
      });
    }
    return client;
  }

  global.ScorebookSupabase = {
    environment,
    label: selectedConfig.label,
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    configs: SUPABASE_CONFIGS,
    configured,
    available,
    getClient
  };
})(window);
