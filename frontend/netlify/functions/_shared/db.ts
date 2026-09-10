import postgres from "postgres";

export type Queryable = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: any[]): Promise<T[]>;
};

let instance: Queryable | undefined;

export function database(): Queryable {
  if (instance) return instance;
  const connectionString = process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) throw new Error("SUPABASE_DATABASE_URL is required");
  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    ssl: "require",
    idle_timeout: 20,
    connect_timeout: 15,
  });
  instance = {
    query: (text, params = []) => sql.unsafe(text, params as any[]) as unknown as Promise<any[]>,
  };
  return instance;
}
