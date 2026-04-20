(function initScorebookSupabase(global) {
  const SUPABASE_URL = "https://oxtikmowvunvicgvvdqa.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LGv3_bhJ1K2xpGQmP8Wktw_-etjR4O1";

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
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    configured,
    available,
    getClient
  };
})(window);
