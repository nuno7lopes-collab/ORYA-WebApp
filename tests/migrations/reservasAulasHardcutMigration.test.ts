import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readLocal(pathname: string) {
  return fs.readFileSync(path.join(process.cwd(), pathname), "utf8");
}

describe("reservas+aulas hardcut migration contract", () => {
  it("inclui colunas de policy de grid e duração por organização", () => {
    const migration = readLocal(
      "prisma/migrations/20260221163000_reservas_aulas_hardcut_pr1/migration.sql",
    );

    expect(migration).toContain("booking_grid_minutes");
    expect(migration).toContain("booking_allowed_durations");
    expect(migration).toContain("booking_allow_custom_duration");
  });

  it("inclui ligação canónica treinador-profissional e unicidade por org+user", () => {
    const migration = readLocal(
      "prisma/migrations/20260221163000_reservas_aulas_hardcut_pr1/migration.sql",
    );

    expect(migration).toContain("reservation_professionals_org_user_unique");
    expect(migration).toContain("reservation_professional_id");
    expect(migration).toContain("trainer_profiles_org_prof_unique");
  });

  it("inclui conversão de serviços AULAS GENERAL para CLASS quando recorrentes", () => {
    const migration = readLocal(
      "prisma/migrations/20260221163000_reservas_aulas_hardcut_pr1/migration.sql",
    );

    expect(migration).toContain("UPDATE app_v3.services s");
    expect(migration).toContain("s.kind = 'GENERAL'");
    expect(migration).toContain("upper(btrim(COALESCE(s.category_tag, ''))) = 'AULAS'");
    expect(migration).toContain("SET kind = 'CLASS'");
  });
});
