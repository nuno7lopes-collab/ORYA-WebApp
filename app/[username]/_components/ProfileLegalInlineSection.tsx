type BookingPolicyView = {
  allowCancellation: boolean;
  cancellationWindowMinutes: number | null;
  allowReschedule: boolean;
  rescheduleWindowMinutes: number | null;
} | null;

type StorePolicyView = {
  supportEmail: string | null;
  supportPhone: string | null;
  returnPolicy: string | null;
  privacyPolicy: string | null;
};

type ProfileLegalInlineSectionProps = {
  displayName: string;
  bookingPolicy: BookingPolicyView;
  storePolicy: StorePolicyView;
};

function formatWindow(minutes: number | null) {
  if (minutes === null) return "nao permitido";
  if (minutes === 0) return "ate ao momento de inicio";
  if (minutes % 1440 === 0) return `ate ${minutes / 1440} dia(s) antes do inicio`;
  if (minutes % 60 === 0) return `ate ${minutes / 60} hora(s) antes do inicio`;
  return `ate ${minutes} minuto(s) antes do inicio`;
}

export default function ProfileLegalInlineSection({
  displayName,
  bookingPolicy,
  storePolicy,
}: ProfileLegalInlineSectionProps) {
  return (
    <section id="legal" className="space-y-5 pb-8">
      <div className="border-b border-white/10 pb-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/82">Legal</p>
        <h3 className="mt-2 text-lg font-semibold text-white">Politicas e termos</h3>
        <p className="mt-2 text-sm text-white/78">Informacao legal de {displayName} integrada no perfil.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <a href="#termos" className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80">
            Termos
          </a>
          <a href="#privacidade" className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80">
            Privacidade
          </a>
          <a href="#reservas" className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80">
            Reservas
          </a>
          <a
            href="#loja-devolucoes"
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/80"
          >
            Loja
          </a>
        </div>
      </div>

      <article id="termos" className="rounded-2xl border border-white/18 bg-white/[0.04] p-4">
        <h4 className="text-base font-semibold text-white">Termos de utilizacao</h4>
        <p className="mt-2 text-sm text-white/75">
          Os servicos desta organizacao sao disponibilizados na ORYA e seguem os termos da plataforma, acrescidos das
          regras operacionais configuradas abaixo. Ao concluir compras ou reservas, o utilizador aceita estes termos.
        </p>
      </article>

      <article id="privacidade" className="rounded-2xl border border-white/18 bg-white/[0.04] p-4">
        <h4 className="text-base font-semibold text-white">Privacidade</h4>
        <p className="mt-2 text-sm text-white/75">
          {storePolicy.privacyPolicy ?? "A privacidade segue o template legal da ORYA."}
        </p>
        {(storePolicy.supportEmail || storePolicy.supportPhone) && (
          <p className="mt-3 text-sm text-white/70">
            Contacto de suporte: {storePolicy.supportEmail ?? "nao definido"}
            {storePolicy.supportPhone ? ` | ${storePolicy.supportPhone}` : ""}
          </p>
        )}
      </article>

      <article id="reservas" className="rounded-2xl border border-white/18 bg-white/[0.04] p-4">
        <h4 className="text-base font-semibold text-white">Politica de reservas e cancelamentos</h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/75">
          <li>
            Cancelamento por cliente: {bookingPolicy?.allowCancellation ? formatWindow(bookingPolicy.cancellationWindowMinutes) : "nao permitido"}.
          </li>
          <li>Reembolso elegivel por cliente: valor pago menos apenas a taxa real de processamento do pagamento.</li>
          <li>Nao existe penalizacao percentual configuravel de cancelamento nesta versao.</li>
          <li>Cancelamento iniciado pela organizacao: reembolso total.</li>
          <li>
            Reagendamento: {bookingPolicy?.allowReschedule
              ? formatWindow(bookingPolicy.rescheduleWindowMinutes ?? bookingPolicy.cancellationWindowMinutes ?? null)
              : "nao permitido"}
            .
          </li>
        </ul>
      </article>

      <article id="loja-devolucoes" className="rounded-2xl border border-white/18 bg-white/[0.04] p-4">
        <h4 className="text-base font-semibold text-white">Politica da loja</h4>
        <p className="mt-2 text-sm text-white/75">
          {storePolicy.returnPolicy ?? "Politica de devolucoes ainda nao configurada para esta organizacao."}
        </p>
      </article>
    </section>
  );
}
