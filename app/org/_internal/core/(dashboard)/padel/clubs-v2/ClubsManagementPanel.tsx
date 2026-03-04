type BadgeTone = "green" | "amber" | "blue" | "slate";
type ClubItem = {
  id: number;
  name: string;
  city: string | null;
  courtsCount: number;
  isActive: boolean;
  createdAt: string | Date;
  addressId?: string | null;
  kind?: "OWN" | "PARTNER" | null;
  sourceClubId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  addressRef?: {
    id?: string;
    formattedAddress?: string | null;
    canonical?: Record<string, unknown> | null;
    latitude?: number | null;
    longitude?: number | null;
    sourceProvider?: string | null;
    sourceProviderPlaceId?: string | null;
    confidenceScore?: number | null;
    validationStatus?: string | null;
  } | null;
  slug?: string | null;
};
type ClubCourtItem = {
  id: number;
  padelClubId: number;
  name: string;
  description: string | null;
  indoor: boolean;
  isActive: boolean;
  displayOrder: number;
};
type ClubStaffItem = {
  id: number;
  padelClubId: number;
  userId: string;
  fullName?: string | null;
  role: string;
  inheritToEvents: boolean;
  user?: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
};
type StaffOptionItem = {
  userId: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
};
type CourtForm = {
  id: number | null;
  name: string;
  description: string;
  indoor: boolean;
  isActive: boolean;
  displayOrder: number;
};
type StaffForm = {
  id: number | null;
  email: string;
  staffMemberId: string;
  role: string;
  inheritToEvents: boolean;
};
export function ClubsManagementPanel(props: {
  isPadelReadOnly: boolean;
  showClubStaffPanel: boolean;
  visibleClubs: ClubItem[];
  drawerClubId: number | null;
  selectedClub: ClubItem | null;
  loadingDrawer: boolean;
  courtsPanelReadOnly: boolean;
  courts: ClubCourtItem[];
  courtForm: CourtForm;
  savingCourt: boolean;
  courtError: string | null;
  courtMessage: string | null;
  draggingCourtId: number | null;
  staff: ClubStaffItem[];
  inheritedStaffCount: number;
  staffMode: "existing" | "external";
  staffSearch: string;
  staffForm: StaffForm;
  staffOptions: StaffOptionItem[];
  staffError: string | null;
  staffMessage: string | null;
  staffInviteNotice: string | null;
  ctaPrimaryClass: string;
  ctaPrimarySmClass: string;
  badgeClass: (tone: BadgeTone) => string;
  compactAddress: (club: ClubItem) => string;
  activeCourtsForClub: (club: ClubItem) => number;
  onOpenNewClubModal: () => void;
  onSelectClub: (clubId: number) => void;
  onToggleClubActiveDialog: (club: ClubItem) => void;
  onDeleteClubDialog: (club: ClubItem) => void;
  onCloseDrawer: () => void;
  onCourtFormPatch: (patch: Partial<CourtForm>) => void;
  onSubmitCourt: () => void;
  onResetCourt: () => void;
  onCourtDragStart: (courtId: number) => void;
  onCourtDrop: (courtId: number) => void;
  onCourtDragEnd: () => void;
  onEditCourt: (court: ClubCourtItem) => void;
  onToggleCourtActiveDialog: (court: ClubCourtItem) => void;
  onDeleteCourtDialog: (court: ClubCourtItem) => void;
  onStaffModeChange: (mode: "existing" | "external") => void;
  onStaffSearchChange: (value: string) => void;
  onStaffFormPatch: (patch: Partial<StaffForm>) => void;
  onSubmitStaff: () => void;
  onResetStaff: () => void;
  onEditStaff: (member: ClubStaffItem) => void;
}) {
  return (
    <div className="space-y-4 transition-all duration-250 ease-out opacity-100 translate-y-0">
      {" "}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {" "}
        <div>
          {" "}
          <h2 className="text-sm font-semibold text-white">Clubes</h2>{" "}
          <p className="text-[12px] text-white/65">
            Criação de clubes e gestão de campos no mesmo fluxo.
          </p>{" "}
          {props.isPadelReadOnly ? (
            <p className="mt-2 text-[12px] text-amber-200">
              Modo apenas leitura: sem permissões para alterar clubes.
            </p>
          ) : null}{" "}
        </div>{" "}
        <div className="flex flex-wrap items-center gap-2">
          {" "}
          <button
            type="button"
            onClick={props.onOpenNewClubModal}
            disabled={props.isPadelReadOnly}
            className={props.ctaPrimaryClass}
          >
            {" "}
            {props.visibleClubs.length > 0 ? "Editar clube" : "Novo clube"}{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
      {props.visibleClubs.length === 0 ? (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-white">
          {" "}
          <p className="text-lg font-semibold">Sem clubes.</p>{" "}
          <p className="text-sm text-white/70">
            Adiciona o clube principal com morada e campos.
          </p>{" "}
          <div className="mt-3 flex gap-2">
            {" "}
            <button
              type="button"
              onClick={props.onOpenNewClubModal}
              disabled={props.isPadelReadOnly}
              className={props.ctaPrimaryClass}
            >
              {" "}
              Criar clube{" "}
            </button>{" "}
          </div>{" "}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {" "}
          {props.visibleClubs.map((club) => (
            <div
              key={club.id}
              className={`rounded-2xl p-4 ${club.isActive ? "border border-emerald-400/40 bg-emerald-500/5" : "border border-red-500/40 bg-red-500/8"} ${props.drawerClubId === club.id ? "ring-2 ring-cyan-400/40" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => props.onSelectClub(club.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "") {
                  event.preventDefault();
                  props.onSelectClub(club.id);
                }
              }}
            >
              {" "}
              <div className="flex items-start justify-between gap-3">
                {" "}
                <div className="space-y-1">
                  {" "}
                  <p className="text-base font-semibold text-white">
                    {club.name}
                  </p>{" "}
                  <p className="text-[12px] text-white/65">
                    {props.compactAddress(club)}
                  </p>{" "}
                  <p className="text-[12px] text-white/55">
                    Campos ativos: {props.activeCourtsForClub(club)}
                  </p>{" "}
                </div>{" "}
                <div className="flex flex-col items-end gap-2">
                  {" "}
                  <span
                    className={
                      club.isActive
                        ? props.badgeClass("green")
                        : "rounded-full border border-red-400/50 bg-red-500/15 px-3 py-1 text-[12px] text-red-100"
                    }
                  >
                    {" "}
                    {club.isActive ? "Ativo" : "Inativo"}{" "}
                  </span>{" "}
                </div>{" "}
              </div>{" "}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {" "}
                {!props.isPadelReadOnly ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onToggleClubActiveDialog(club);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-[12px] ${club.isActive ? "border-amber-300/60 bg-amber-400/15 text-amber-50 hover:border-amber-200/80" : "border-emerald-400/60 bg-emerald-500/15 text-emerald-50 hover:border-emerald-300/80"}`}
                  >
                    {" "}
                    {club.isActive ? "Arquivar" : "Reativar"}{" "}
                  </button>
                ) : null}{" "}
                {!props.isPadelReadOnly && !club.isActive ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onDeleteClubDialog(club);
                    }}
                    className="rounded-full border border-red-400/60 bg-red-500/15 px-3 py-1.5 text-[12px] text-red-50 hover:border-red-300/80"
                  >
                    {" "}
                    Apagar{" "}
                  </button>
                ) : null}{" "}
              </div>{" "}
            </div>
          ))}{" "}
        </div>
      )}{" "}
      {props.drawerClubId && props.selectedClub ? (
        <div className="space-y-4 rounded-2xl border border-white/12 bg-white/[0.04] p-4">
          {" "}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {" "}
            <div>
              {" "}
              <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">
                Campos do clube
              </p>{" "}
              <p className="text-sm text-white/70">
                Atualização operacional dos campos por clube.
              </p>{" "}
            </div>{" "}
            <div className="flex items-center gap-2">
              {" "}
              <span className={props.badgeClass("slate")}>
                {props.selectedClub.name}
              </span>{" "}
              <button
                type="button"
                onClick={props.onCloseDrawer}
                className="rounded-full border border-white/15 px-3 py-1 text-[12px] text-white hover:border-white/30"
              >
                {" "}
                Fechar{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
          {props.loadingDrawer ? (
            <div className="space-y-3">
              {" "}
              <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />{" "}
              <div
                className={`grid gap-3 ${props.showClubStaffPanel ? "lg:grid-cols-2" : ""}`}
              >
                {" "}
                {[...Array(props.showClubStaffPanel ? 2 : 1)].map((_, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 rounded-xl border border-white/12 bg-white/5 p-3 animate-pulse"
                  >
                    {" "}
                    <div className="h-4 w-1/2 rounded bg-white/10" />{" "}
                    <div className="h-10 rounded bg-white/5" />{" "}
                    <div className="h-10 rounded bg-white/5" />{" "}
                    <div className="h-3 w-24 rounded bg-white/10" />{" "}
                  </div>
                ))}{" "}
              </div>{" "}
            </div>
          ) : null}{" "}
          <div
            className={`grid gap-4 ${props.showClubStaffPanel ? "lg:grid-cols-2" : ""}`}
          >
            {" "}
            <div className="space-y-3 rounded-xl border border-white/12 bg-white/[0.04] p-3">
              {" "}
              <div className="flex items-center justify-between">
                {" "}
                <p className="text-sm font-semibold text-white">
                  Campos do clube
                </p>{" "}
                <span className={props.badgeClass("slate")}>
                  {props.courts.filter((court) => court.isActive).length} ativos
                </span>{" "}
              </div>{" "}
              {props.courtsPanelReadOnly ? (
                <p className="text-[11px] text-amber-200">
                  Sem permissões para editar campos neste modo.
                </p>
              ) : null}{" "}
              <div className="grid gap-2 sm:grid-cols-2">
                {" "}
                <input
                  value={props.courtForm.name}
                  onChange={(event) =>
                    props.onCourtFormPatch({ name: event.target.value })
                  }
                  disabled={props.courtsPanelReadOnly}
                  className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#22D3EE] disabled:opacity-60"
                  placeholder="Nome do campo"
                />{" "}
                <input
                  value={props.courtForm.description}
                  onChange={(event) =>
                    props.onCourtFormPatch({ description: event.target.value })
                  }
                  disabled={props.courtsPanelReadOnly}
                  className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#22D3EE] disabled:opacity-60"
                  placeholder="Descrição / patrocinador (opcional)"
                />{" "}
                <div className="col-span-2 flex flex-wrap items-center gap-2 text-sm text-white/80">
                  {" "}
                  <span className="text-[12px] uppercase tracking-[0.2em] text-white/60">
                    Tipo
                  </span>{" "}
                  <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                    {" "}
                    {[
                      { key: false, label: "Outdoor" },
                      { key: true, label: "Indoor" },
                    ].map((opt) => (
                      <button
                        key={String(opt.key)}
                        type="button"
                        onClick={() =>
                          props.onCourtFormPatch({ indoor: opt.key })
                        }
                        className={`rounded-full px-3 py-1 transition ${props.courtForm.indoor === opt.key ? "bg-white text-black font-semibold shadow" : "text-white/75 hover:bg-white/5"}`}
                        disabled={props.courtsPanelReadOnly}
                      >
                        {" "}
                        {opt.label}{" "}
                      </button>
                    ))}{" "}
                  </div>{" "}
                  <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                    {" "}
                    {[
                      { key: true, label: "Ativo" },
                      { key: false, label: "Inativo" },
                    ].map((opt) => (
                      <button
                        key={String(opt.key)}
                        type="button"
                        onClick={() =>
                          props.onCourtFormPatch({ isActive: opt.key })
                        }
                        className={`rounded-full px-3 py-1 transition ${props.courtForm.isActive === opt.key ? (opt.key ? "bg-emerald-400 text-black font-semibold" : "bg-white text-black font-semibold") : "text-white/75 hover:bg-white/5"}`}
                        disabled={props.courtsPanelReadOnly}
                      >
                        {" "}
                        {opt.label}{" "}
                      </button>
                    ))}{" "}
                  </div>{" "}
                </div>{" "}
              </div>{" "}
              <div className="flex flex-wrap gap-2">
                {" "}
                <button
                  type="button"
                  onClick={props.onSubmitCourt}
                  disabled={props.savingCourt || props.courtsPanelReadOnly}
                  className={`${props.ctaPrimarySmClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {" "}
                  {props.savingCourt
                    ? "A guardar…"
                    : props.courtForm.id
                      ? "Atualizar campo"
                      : "Guardar campo"}{" "}
                </button>{" "}
                {props.courtForm.id ? (
                  <button
                    type="button"
                    onClick={props.onResetCourt}
                    disabled={props.courtsPanelReadOnly}
                    className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/35 disabled:opacity-60"
                  >
                    {" "}
                    Cancelar{" "}
                  </button>
                ) : null}{" "}
              </div>{" "}
              {props.courtError || props.courtMessage ? (
                <span className="text-[12px] text-white/70">
                  {props.courtError || props.courtMessage}
                </span>
              ) : null}{" "}
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-2 text-[12px] text-white/80">
                {" "}
                {props.courts.length === 0 ? (
                  <p className="text-white/60">Sem campos ainda.</p>
                ) : null}{" "}
                {props.courts.map((court, idx) => (
                  <div
                    key={court.id}
                    draggable={!props.courtsPanelReadOnly}
                    onDragStart={() => props.onCourtDragStart(court.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      props.onCourtDrop(court.id);
                    }}
                    onDragEnd={props.onCourtDragEnd}
                    className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 transition ${court.isActive ? "border border-emerald-400/35 bg-emerald-500/5" : "border border-red-500/40 bg-red-500/8"} ${props.draggingCourtId === court.id ? "opacity-60" : "opacity-100"}`}
                  >
                    {" "}
                    <div className="flex items-center gap-3">
                      {" "}
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg font-bold ${court.isActive ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-50" : "border-red-400/40 bg-red-500/10 text-red-100"}`}
                      >
                        {" "}
                        {idx + 1}{" "}
                      </div>{" "}
                      <div>
                        {" "}
                        <p className="text-sm font-semibold text-white">
                          {court.name}
                        </p>{" "}
                        <p
                          className={`text-[11px] ${court.isActive ? "text-emerald-100/80" : "text-red-100/80"}`}
                        >
                          {" "}
                          {court.indoor ? "Indoor" : "Outdoor"} · Ordem{" "}
                          {court.displayOrder} ·{" "}
                          {court.isActive ? "Ativo" : "Inativo"}{" "}
                        </p>{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="flex items-center gap-2">
                      {" "}
                      <button
                        type="button"
                        onClick={() => props.onEditCourt(court)}
                        disabled={props.courtsPanelReadOnly}
                        className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white hover:border-white/30 disabled:opacity-60"
                      >
                        {" "}
                        Editar{" "}
                      </button>{" "}
                      {!props.courtsPanelReadOnly ? (
                        <button
                          type="button"
                          onClick={() => props.onToggleCourtActiveDialog(court)}
                          className={`rounded-full border px-2 py-1 text-[11px] ${court.isActive ? "border-amber-300/60 bg-amber-400/15 text-amber-50 hover:border-amber-200/80" : "border-emerald-400/60 bg-emerald-500/15 text-emerald-50 hover:border-emerald-300/80"}`}
                        >
                          {" "}
                          {court.isActive ? "Desativar" : "Reativar"}{" "}
                        </button>
                      ) : null}{" "}
                      {!props.courtsPanelReadOnly && !court.isActive ? (
                        <button
                          type="button"
                          onClick={() => props.onDeleteCourtDialog(court)}
                          className="rounded-full border border-red-400/60 bg-red-500/15 px-2 py-1 text-[11px] text-red-50 hover:border-red-300/80"
                        >
                          {" "}
                          Apagar{" "}
                        </button>
                      ) : null}{" "}
                    </div>{" "}
                  </div>
                ))}{" "}
              </div>{" "}
            </div>{" "}
            {props.showClubStaffPanel ? (
              <div className="space-y-3 rounded-xl border border-white/12 bg-white/[0.04] p-3">
                {" "}
                <div className="flex items-center justify-between">
                  {" "}
                  <div className="space-y-1">
                    {" "}
                    <p className="text-sm font-semibold text-white">
                      Staff do clube
                    </p>{" "}
                    <p className="text-[11px] text-white/60">
                      {" "}
                      {props.staff.length} membros · {props.inheritedStaffCount}{" "}
                      herdam para torneios{" "}
                    </p>{" "}
                  </div>{" "}
                  <span className={props.badgeClass("slate")}>
                    Herdam: {props.inheritedStaffCount}
                  </span>{" "}
                </div>{" "}
                {props.courtsPanelReadOnly ? (
                  <p className="text-[11px] text-amber-200">
                    Sem permissões para editar staff neste modo.
                  </p>
                ) : null}{" "}
                <div className="grid gap-2 sm:grid-cols-2">
                  {" "}
                  {[
                    {
                      key: "existing" as const,
                      label: "Staff da organização",
                      desc: "Reaproveita quem já tens no staff global e herda para torneios.",
                    },
                    {
                      key: "external" as const,
                      label: "Contacto externo",
                      desc: "Envia convite por email. Só entra no clube após aceitar com conta ORYA.",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => props.onStaffModeChange(opt.key)}
                      disabled={props.courtsPanelReadOnly}
                      className={`rounded-xl border p-3 text-left transition ${props.staffMode === opt.key ? "border-white/60 bg-white/10" : "border-white/15 bg-white/5 hover:border-white/30"} disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {" "}
                      <p className="font-semibold text-white">
                        {opt.label}
                      </p>{" "}
                      <p className="text-[12px] text-white/65">
                        {opt.desc}
                      </p>{" "}
                    </button>
                  ))}{" "}
                </div>{" "}
                {props.staffMode === "existing" ? (
                  <div className="space-y-2 rounded-xl border border-white/12 bg-black/30 p-3">
                    {" "}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {" "}
                      <input
                        value={props.staffSearch}
                        onChange={(event) =>
                          props.onStaffSearchChange(event.target.value)
                        }
                        disabled={props.courtsPanelReadOnly}
                        className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
                        placeholder="Pesquisar membro (nome, email, username)"
                      />{" "}
                      <select
                        value={props.staffForm.staffMemberId}
                        onChange={(event) =>
                          props.onStaffFormPatch({
                            staffMemberId: event.target.value,
                          })
                        }
                        disabled={props.courtsPanelReadOnly}
                        className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
                      >
                        {" "}
                        <option value="">Escolhe membro</option>{" "}
                        {props.staffOptions.map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {" "}
                            {(
                              member.fullName ||
                              member.username ||
                              member.email ||
                              "Membro"
                            ).trim()}{" "}
                            {member.email ? ` · ${member.email}` : ""}{" "}
                          </option>
                        ))}{" "}
                      </select>{" "}
                    </div>{" "}
                    {props.staffForm.staffMemberId ? (
                      <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-[12px] text-white/75">
                        {" "}
                        <p className="font-semibold text-white/90">
                          Resumo rápido
                        </p>{" "}
                        <p className="text-white/70">
                          {" "}
                          Herdado do staff global; ficará marcado como herdado
                          neste clube e nos torneios.{" "}
                        </p>{" "}
                      </div>
                    ) : null}{" "}
                  </div>
                ) : (
                  <div className="space-y-2 rounded-xl border border-white/12 bg-black/30 p-3">
                    {" "}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {" "}
                      <input
                        value={props.staffForm.email}
                        onChange={(event) =>
                          props.onStaffFormPatch({ email: event.target.value })
                        }
                        disabled={props.courtsPanelReadOnly}
                        className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
                        placeholder="Email do contacto"
                      />{" "}
                      <div className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-[12px] text-white/70">
                        {" "}
                        O email recebe convite e a pessoa só entra quando
                        aceitar com conta ORYA.{" "}
                      </div>{" "}
                    </div>{" "}
                  </div>
                )}{" "}
                <div className="grid gap-2 sm:grid-cols-2">
                  {" "}
                  <select
                    value={props.staffForm.role}
                    onChange={(event) =>
                      props.onStaffFormPatch({ role: event.target.value })
                    }
                    disabled={props.courtsPanelReadOnly}
                    className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
                  >
                    {" "}
                    <option value="ADMIN_CLUBE">Admin clube</option>{" "}
                    <option value="DIRETOR_PROVA">Diretor / Árbitro</option>{" "}
                    <option value="STAFF">Staff de campo</option>{" "}
                  </select>{" "}
                  <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                    {" "}
                    {[
                      { key: true, label: "Herdar para torneios" },
                      { key: false, label: "Só neste clube" },
                    ].map((opt) => (
                      <button
                        key={String(opt.key)}
                        type="button"
                        onClick={() =>
                          props.onStaffFormPatch({ inheritToEvents: opt.key })
                        }
                        disabled={props.courtsPanelReadOnly}
                        className={`rounded-full px-3 py-1 transition ${props.staffForm.inheritToEvents === opt.key ? "bg-white text-black font-semibold shadow" : "text-white/75 hover:bg-white/5"} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {" "}
                        {opt.label}{" "}
                      </button>
                    ))}{" "}
                  </div>{" "}
                </div>{" "}
                <div className="flex flex-wrap gap-2">
                  {" "}
                  <button
                    type="button"
                    onClick={props.onSubmitStaff}
                    disabled={props.courtsPanelReadOnly}
                    className={`${props.ctaPrimarySmClass} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {" "}
                    {props.staffForm.id ? "Atualizar" : "Adicionar"}{" "}
                  </button>{" "}
                  {props.staffForm.id ? (
                    <button
                      type="button"
                      onClick={props.onResetStaff}
                      disabled={props.courtsPanelReadOnly}
                      className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white hover:border-white/35 disabled:opacity-60"
                    >
                      {" "}
                      Cancelar{" "}
                    </button>
                  ) : null}{" "}
                  {props.staffError ||
                  props.staffMessage ||
                  props.staffInviteNotice ? (
                    <span className="text-[12px] text-white/70">
                      {" "}
                      {props.staffError ||
                        props.staffMessage ||
                        props.staffInviteNotice}{" "}
                    </span>
                  ) : null}{" "}
                </div>{" "}
                <div className="space-y-2 rounded-lg border border-white/12 bg-white/5 p-2 text-[12px] text-white/80">
                  {" "}
                  {props.staff.length === 0 ? (
                    <p className="text-white/60">Sem staff.</p>
                  ) : null}{" "}
                  {props.staff.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-md border border-white/10 bg-black/40 px-2 py-1.5"
                    >
                      {" "}
                      <div className="space-y-0.5">
                        {" "}
                        <p className="text-sm text-white">
                          {member.user?.fullName ||
                            member.user?.username ||
                            member.userId}
                        </p>{" "}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                          {" "}
                          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-[2px]">
                            {member.role}
                          </span>{" "}
                          <span
                            className={`rounded-full border px-2 py-[2px] ${member.inheritToEvents ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-100" : "border-white/20 bg-white/5 text-white/70"}`}
                          >
                            {" "}
                            {member.inheritToEvents
                              ? "Herdado"
                              : "Só clube"}{" "}
                          </span>{" "}
                          {member.user?.username ? (
                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-[2px]">
                              {" "}
                              @{member.user.username}{" "}
                            </span>
                          ) : null}{" "}
                        </div>{" "}
                      </div>{" "}
                      <button
                        type="button"
                        onClick={() => props.onEditStaff(member)}
                        disabled={props.courtsPanelReadOnly}
                        className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white hover:border-white/30 disabled:opacity-60"
                      >
                        {" "}
                        Editar{" "}
                      </button>{" "}
                    </div>
                  ))}{" "}
                </div>{" "}
              </div>
            ) : null}{" "}
          </div>{" "}
        </div>
      ) : null}{" "}
    </div>
  );
}
