import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = "admin@over-inc.test";
const TEST_PASSWORD = "testpassword123";

async function seed() {
  console.log("--- Seeding OVERworks ---\n");

  // 1. Create team
  console.log("1. Creating team...");
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({ name: "OVER Inc." })
    .select("id")
    .single();

  if (teamError) {
    console.error("  Team creation failed:", teamError.message);
    process.exit(1);
  }
  console.log(`  Team created: ${team.id}`);

  // 2. Create auth user (bypasses email confirmation)
  console.log("2. Creating auth user...");
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "Admin User" },
    });

  if (authError) {
    console.error("  User creation failed:", authError.message);
    process.exit(1);
  }
  const userId = authData.user.id;
  console.log(`  User created: ${userId}`);

  // 3. Create profile (directly, since trigger doesn't exist)
  console.log("3. Creating profile...");
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    email: TEST_EMAIL,
    display_name: "Admin User",
    role: "admin",
    team_id: team.id,
  });

  if (profileError) {
    console.error("  Profile creation failed:", profileError.message);
    process.exit(1);
  }
  console.log("  Profile created");

  // 4. Create default template settings
  console.log("4. Creating template settings...");
  const { error: templateError } = await supabase
    .from("template_settings")
    .insert({ team_id: team.id });

  if (templateError) {
    console.error("  Template settings failed:", templateError.message);
    // Non-critical, continue
  } else {
    console.log("  Template settings created");
  }

  console.log("\n--- Seed complete ---");
  console.log(`\nLogin credentials:`);
  console.log(`  Email:    ${TEST_EMAIL}`);
  console.log(`  Password: ${TEST_PASSWORD}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
