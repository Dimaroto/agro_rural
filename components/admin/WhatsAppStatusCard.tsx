function formatWhatsAppDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

type WhatsAppStatusCardProps = {
  whatsapp: string | null;
};

export function WhatsAppStatusCard({ whatsapp }: WhatsAppStatusCardProps) {
  const digits = whatsapp?.replace(/\D/g, "") ?? "";
  const configured = digits.length >= 10;

  return (
    <div className="admin-card p-4">
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
        WhatsApp da loja
      </h2>

      {configured ? (
        <>
          <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Configurado
          </p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            {formatWhatsAppDisplay(whatsapp!)}
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Os clientes usam este número no botão flutuante do catálogo. Para
            alterar, use a engrenagem no menu superior.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            Não configurado
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Configure o número na engrenagem do menu para o botão de WhatsApp
            aparecer no catálogo público.
          </p>
        </>
      )}
    </div>
  );
}
