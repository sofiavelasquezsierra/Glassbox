import { describe, expect, it } from "vitest";
import { validateSelect } from "@/server/sql/validate";

async function rejects(sql: string, code: string) {
  const r = await validateSelect(sql);
  expect(r.ok, `expected rejection for: ${sql}`).toBe(false);
  if (!r.ok) expect(r.code).toBe(code);
}

describe("validateSelect: accepts analytics SELECTs", () => {
  it("accepts a parameterized aggregate over northwind tables", async () => {
    const r = await validateSelect(`
      select date_trunc('week', e.occurred_at at time zone :timezone) as week,
             count(distinct e.user_id) as active_users
      from northwind.events e
      join northwind.users u on u.id = e.user_id
      where e.occurred_at >= (:date_range_start::date)::timestamp at time zone :timezone
        and (:exclude_test_accounts = false or not u.is_internal)
      group by 1 order by 1`);
    expect(r).toEqual({ ok: true, tables: ["events", "users"], params: ["timezone", "date_range_start", "exclude_test_accounts"] });
  });

  it("accepts CTEs, window functions and unqualified table names", async () => {
    const r = await validateSelect(`
      with monthly as (
        select org_id, date_trunc('month', issued_at) m, sum(amount_cents) cents
        from invoices group by 1, 2
      )
      select org_id, m, cents, lag(cents) over (partition by org_id order by m) prev
      from monthly`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tables).toEqual(["invoices"]);
  });

  it("accepts a single trailing semicolon and comments", async () => {
    const r = await validateSelect("-- count orgs\nselect count(*) from northwind.organizations; /* done */");
    expect(r.ok).toBe(true);
  });
});

describe("validateSelect: rejects anything that is not a single SELECT", () => {
  it.each([
    ["insert into northwind.plans (name) values ('x')", "not_select"],
    ["update northwind.users set role = 'admin'", "not_select"],
    ["delete from northwind.events", "not_select"],
    ["drop table northwind.events", "not_select"],
    ["truncate northwind.invoices", "not_select"],
    ["grant all on northwind.users to public", "not_select"],
    ["set statement_timeout = 0", "not_select"],
    ["copy northwind.users to stdout", "not_select"],
    ["explain analyze delete from northwind.events", "not_select"],
    ["begin", "not_select"],
  ])("%s", async (sql, code) => rejects(sql, code));

  it("rejects multiple statements", () => rejects("select 1; select 2", "multiple_statements"));

  it("rejects a write smuggled after a line comment", () =>
    rejects("select 1 -- harmless\n; delete from northwind.events", "multiple_statements"));

  it("rejects a write hidden after a block comment", () =>
    rejects("/* select only */ delete from northwind.events", "not_select"));

  it("does not treat a semicolon inside a comment as a statement break", async () => {
    // The only real statement is the SELECT; the DELETE is entirely commented out.
    const r = await validateSelect("select 1 /* ; delete from northwind.events */");
    expect(r.ok).toBe(true);
  });

  it("rejects a write placed inside a string-terminating trick", () =>
    rejects("select 'a'''; delete from northwind.events; --'", "multiple_statements"));

  it("rejects data-modifying CTEs", () =>
    rejects("with gone as (delete from northwind.events returning *) select count(*) from gone", "forbidden_statement"));

  it("rejects an UPDATE nested in a CTE", () =>
    rejects("with x as (update northwind.users set role='owner' returning id) select * from x", "forbidden_statement"));

  it("rejects SELECT INTO", () => rejects("select * into stolen from northwind.users", "select_into"));

  it("rejects row locks", () => rejects("select * from northwind.users for update", "locking_clause"));
});

describe("validateSelect: rejects reads outside the allowed surface", () => {
  it.each([
    ["select * from auth.users", "table_not_allowed"],
    ["select * from public.secrets", "table_not_allowed"],
    ["select * from pg_catalog.pg_authid", "table_not_allowed"],
    ["select usename, passwd from pg_shadow", "table_not_allowed"],
    ["select * from northwind.not_a_table", "table_not_allowed"],
    ["select * from (select * from information_schema.tables) t", "table_not_allowed"],
    ["select * from northwind.users where id in (select id from storage.objects)", "table_not_allowed"],
  ])("%s", async (sql, code) => rejects(sql, code));

  it.each([
    ["select pg_sleep(10)", "function_not_allowed"],
    ["select pg_read_file('/etc/passwd')", "function_not_allowed"],
    ["select set_config('default_transaction_read_only', 'off', false)", "function_not_allowed"],
    ["select dblink_exec('host=evil', 'drop table x')", "function_not_allowed"],
    ["select lo_import('/etc/passwd')", "function_not_allowed"],
    ["select public.count(*) from northwind.users", "function_not_allowed"],
    ["select pg_terminate_backend(1)", "function_not_allowed"],
  ])("%s", async (sql, code) => rejects(sql, code));

  it("rejects wall-clock time so results stay reproducible", async () => {
    await rejects("select count(*) from northwind.users where created_at > now() - interval '30 days'", "nondeterministic_time");
    await rejects("select count(*) from northwind.users where created_at > current_date - 30", "nondeterministic_time");
  });
});

describe("validateSelect: input hygiene", () => {
  it("rejects empty input", () => rejects("   ", "empty"));
  it("rejects syntax errors", () => rejects("selec * from northwind.users", "parse_error"));
  it("rejects raw positional parameters", () => rejects("select * from northwind.users where id = $1", "positional_params"));
  it("rejects unterminated strings", () => rejects("select 'oops from northwind.users", "parse_error"));
  it("rejects very long input", () => rejects(`select ${"1,".repeat(15_000)}1`, "too_long"));
});
